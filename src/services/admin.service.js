import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { calculateBookingPrice } from './booking.service.js';

export const getPendingBookings = async () => {
  return await prisma.booking.findMany({
    where: { status: { in: ['PENDING', 'SCHEDULED'] } },
    include: {
      farmer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export const scheduleBooking = async (bookingId, scheduledDate) => {
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) },
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.status?.toUpperCase() !== 'PENDING' && booking.status?.toUpperCase() !== 'SCHEDULED') {
    throw new Error('INVALID_TRANSITION: Booking can only be scheduled from pending or scheduled state');
  }

  return await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'SCHEDULED',
      scheduledAt: new Date(scheduledDate)
    }
  });
};

export const getAvailableOperators = async () => {
  // Use 'availability' field (NOT 'status') — status is for authentication only
  return await prisma.user.findMany({
    where: {
      role: 'operator',
      status: 'active',             // must have active account
      availability: 'available',    // must be free to take a job
      tractor: {
        is: {
          status: 'AVAILABLE'
        }
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      availability: true,
      tractor: {
        select: { id: true, name: true, model: true }
      }
    }
  });
};

export const assignOperator = async (bookingId, operatorId) => {
  // 1. Validate booking exists and is scheduled
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) },
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.status?.toUpperCase() !== 'SCHEDULED') throw new Error('INVALID_TRANSITION: Booking is not in scheduled state');

  // 2. Validate operator exists
  const operator = await prisma.user.findUnique({
    where: { id: parseInt(operatorId) },
    include: { tractor: true }
  });

  if (!operator || operator.role !== 'operator') {
    throw new Error('Operator not found or role is not operator');
  }

  // 3. Find available tractor assigned to this operator
  const tractor = await prisma.tractor.findFirst({
    where: {
      operatorId: operator.id,
      status: 'AVAILABLE'
    }
  });

  if (!tractor) {
    throw new Error('No available tractor found for this operator');
  }

  // 4. Atomic transaction: booking gets ASSIGNED, operator.availability = busy, tractor = busy
  const [updatedBooking] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        operatorId: operator.id,
        tractorId: tractor.id,
        status: 'ASSIGNED',
      },
    }),
    prisma.user.update({
      where: { id: operator.id },
      data: { availability: 'busy' },   // ← USE availability, NOT status
    }),
    prisma.tractor.update({
      where: { id: tractor.id },
      data: { status: 'IN_USE' },
    })
  ]);

  return updatedBooking;
};

/**
 * Get bookings with pagination, search, and filtering.
 */
export const getAllBookings = async (query = {}) => {
  const { page = 1, limit = 8, status, search } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  // Status Filter
  if (status && status !== 'All') {
    // Normalize status: handle "in progress" -> "IN_PROGRESS" for Prisma enum matching
    where.status = status.toUpperCase().replace(/\s+/g, '_');
  }

  // Search Filter (Farmer Name, Email, Service Name, Status or Booking ID)
  if (search) {
    const searchInt = parseInt(search);
    const searchUpper = search.toUpperCase();
    
    where.OR = [
      { farmer: { name: { contains: search } } },
      { farmer: { phone: { contains: search } } },
      { service: { name: { contains: search } } },
      { status: { contains: searchUpper } } 
    ];
    
    if (!isNaN(searchInt)) {
      where.OR.push({ id: searchInt });
    }
  }

  console.log(`[AdminService] Fetching bookings with filter:`, where);

  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        farmer: { select: { id: true, name: true, email: true } },
        service: { select: { name: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / take);

  return {
    data: bookings,
    totalPages,
    currentPage: parseInt(page),
    totalCount
  };
};

/**
 * Get a single booking by ID with full context (Farmer, Service, Operator, Tractor).
 */
export const getBookingById = async (id) => {
  const bId = parseInt(id);
  
  // 1. Fetch core booking
  const booking = await prisma.booking.findUnique({
    where: { id: bId }
  });

  if (!booking) throw new Error('Booking not found');

  // 2. Fetch related data manually to ensure stability and avoid Prisma relation errors
  const [farmer, service, operator, tractor, payments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: booking.farmerId },
      select: { name: true, email: true, phone: true }
    }),
    prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { name: true }
    }),
    booking.operatorId ? prisma.user.findUnique({
      where: { id: booking.operatorId },
      select: { name: true, email: true, phone: true }
    }) : Promise.resolve(null),
    booking.tractorId ? prisma.tractor.findUnique({
      where: { id: booking.tractorId },
      select: { id: true, name: true, model: true }
    }) : Promise.resolve(null),
    prisma.payment.findMany({
      where: { bookingId: bId }
    })
  ]);

  // 3. Construct unified response object
  return {
    ...booking,
    farmer,
    service,
    operator,
    tractor,
    payments
  };
};

/**
 * Get ALL payments in the system for admin revenue tracking.
 */
export const getAllPayments = async (query = {}) => {
  const { page = 1, limit = 8, status = 'all', search } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  console.log(`[AdminService] Fetching ledger with query:`, query);

  const paymentWhere = {};
  // 1. Define filtration and search conditions
  let bookingWhere = { paymentStatus: { not: 'PAID' } };

  if (status === 'pending') {
    bookingWhere = { paymentStatus: 'PENDING' };
  } else if (status === 'partial') {
    bookingWhere = { paymentStatus: 'PARTIAL' };
  }

  if (search) {
    const searchInt = parseInt(search);
    const searchFilter = {
      OR: [
        { farmer: { name: { contains: search } } },
        { farmer: { phone: { contains: search } } }
      ]
    };
    if (!isNaN(searchInt)) {
      searchFilter.OR.push({ id: searchInt });
    }

    // Apply to both types
    paymentWhere.booking = searchFilter;
    bookingWhere.farmer = searchFilter.OR[0].farmer; // Simplify for nested
    // Re-apply properly for bookings
    bookingWhere.OR = searchFilter.OR;
  }

  // 2. Fetch data based on status filter
  let combinedLedger = [];
  let totalCount = 0;

  if (status === 'all' || status === 'paid') {
    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        booking: {
          include: {
            farmer: { select: { id: true, name: true, email: true } },
            service: { select: { name: true } },
            payments: { select: { amount: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    combinedLedger.push(...payments.map(p => {
      const paidAmt = p.booking?.payments?.reduce((s, pay) => s + pay.amount, 0) || p.amount;
      const totalAmt = p.booking?.finalPrice || p.booking?.totalPrice || 0;
      return {
        ...p,
        type: 'payment',
        amount: p.amount,
        createdAt: p.createdAt,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        remainingAmount: Math.max(0, totalAmt - paidAmt),
        paymentStatus: p.booking?.paymentStatus || 'PAID',
        method: p.method,
        booking: p.booking
      };
    }));
  }

  if (status === 'all' || status === 'pending' || status === 'partial') {
    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      include: {
        payments: true,
        farmer: { select: { id: true, name: true, email: true } },
        service: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const dues = bookings.map(b => {
      const paidAmount = b.payments.reduce((sum, p) => sum + p.amount, 0);
      const totalAmt = b.finalPrice || b.totalPrice || 0;
      const balance = totalAmt - paidAmount;
      if (balance <= 0) return null;

      return {
        id: `DUE-${b.id}`,
        bookingId: b.id,
        amount: balance,
        type: 'due',
        createdAt: b.createdAt,
        totalAmount: totalAmt,
        paidAmount: paidAmount,
        remainingAmount: balance,
        paymentStatus: b.paymentStatus || 'PENDING',
        method: 'none',
        booking: b
      };
    }).filter(Boolean);

    combinedLedger.push(...dues);
  }

  // 3. Global Stats (independent of pagination)
  const [allPayments, allBookings] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.booking.findMany({ include: { payments: true } })
  ]);
  
  const totalRevenue = allPayments._sum.amount || 0;
  const totalUnpaid = allBookings.reduce((sum, b) => {
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    return sum + Math.max(0, b.totalPrice - paid);
  }, 0);

  // 4. Manual Sorting and Pagination (since we're merging models)
  // For highly scalable systems, this should be a DB view, but for Phase 1 this is efficient.
  combinedLedger.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  totalCount = combinedLedger.length;
  const paginatedLedger = combinedLedger.slice(skip, skip + take);

  return {
    payments: paginatedLedger,
    totalRevenue,
    totalUnpaid,
    totalPages: Math.ceil(totalCount / take),
    currentPage: parseInt(page),
    totalCount
  };
};

/**
 * Handle Admin Settlement (Phase 1)
 * Creates a payment and marks booking as paid in a transaction.
 */
export const settleBooking = async (bookingId, method = 'cash') => {
  throw new Error('Manual settlement is disabled for security. All payments must be processed digitally by the farmer.');
};

/**
 * Get ALL farmers for admin management.
 */
export const getAllFarmers = async () => {
  console.log(`[AdminService] Fetching all farmers for management...`);
  const farmers = await prisma.user.findMany({
    where: { role: 'farmer' },
    include: {
      bookings: { select: { id: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return farmers.map(f => ({
    id: f.id,
    name: f.name,
    email: f.email,
    phone: f.phone,
    location: f.location || 'N/A',
    totalBookings: f.bookings.length,
    status: f.status,
    createdAt: f.createdAt
  }));
};

/**
 * Update farmer account status (activate/deactivate).
 */
export const updateFarmerStatus = async (id, status) => {
  const validStatuses = ['active', 'inactive'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status value');
  }

  return await prisma.user.update({
    where: { id: parseInt(id) },
    data: { status },
    select: {
      id: true,
      name: true,
      status: true
    }
  });
};

/**
 * Get aggregated dashboard metrics
 */
export const getDashboardMetrics = async () => {
  const [activeJobs, pendingAssignments, fleetReady, totalRevenueResult] = await Promise.all([
    prisma.booking.count({
      where: { status: 'IN_PROGRESS' }
    }),
    prisma.booking.count({
      where: { status: 'SCHEDULED' }
    }),
    prisma.tractor.count({
      where: { status: 'AVAILABLE' }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true }
    })
  ]);

  return {
    active_jobs: activeJobs,
    pending_assignment: pendingAssignments,
    fleet_ready: fleetReady,
    total_revenue: totalRevenueResult._sum.amount || 0
  };
};

/**
 * Get assignment queue for dashboard
 */
export const getDashboardAssignmentQueue = async () => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'SCHEDULED' },
    include: {
      farmer: { select: { name: true } },
      service: { select: { name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  return bookings.map(b => ({
    id: b.id,
    farmer_name: b.farmer?.name || 'Unknown',
    service_type: b.service?.name || 'Unknown',
    land_size: b.landSize,
    location: b.location,
    total_price: b.totalPrice
  }));
};

/**
 * Get revenue analytics for dashboard chart
 */
export const getDashboardRevenue = async (timeframe = 'daily') => {
  const recentDate = new Date();
  
  if (timeframe === 'weekly') {
    recentDate.setDate(recentDate.getDate() - 28); // Last 4 weeks
  } else if (timeframe === 'monthly') {
    recentDate.setFullYear(recentDate.getFullYear() - 1); // Last 12 months
  } else {
    recentDate.setDate(recentDate.getDate() - 7); // Last 7 days
  }

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: recentDate }
    },
    select: {
      amount: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const totals = new Map();
  
  payments.forEach(p => {
    let label = '';
    const date = new Date(p.createdAt);
    
    if (timeframe === 'monthly') {
      label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
    } else if (timeframe === 'weekly') {
      // Calculate how many weeks ago this payment was
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      
      if (diffWeeks === 0) label = 'This Wk';
      else if (diffWeeks === 1) label = 'Last Wk';
      else label = `${diffWeeks}W Ago`;
    } else {
      label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    }

    if (!totals.has(label)) {
      totals.set(label, 0);
    }
    totals.set(label, totals.get(label) + p.amount);
  });

  return {
    labels: Array.from(totals.keys()),
    data: Array.from(totals.values())
  };
};
/**
 * Get all active jobs (ASSIGNED or IN_PROGRESS) for admin tracking map.
 * Returns farmer coordinates, operator info, and tractor info.
 */
export const getActiveJobs = async () => {
  const jobs = await prisma.booking.findMany({
    where: {
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
    },
    include: {
      farmer: { select: { id: true, name: true, phone: true } },
      operator: { select: { id: true, name: true, phone: true } },
      service: { select: { name: true } },
      tractor: { select: { id: true, name: true, model: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return jobs.map(j => ({
    id: j.id,
    status: j.status,
    farmerName: j.farmer?.name || 'Unknown',
    farmerLatitude: j.farmerLatitude,
    farmerLongitude: j.farmerLongitude,
    location: j.location,
    operatorId: j.operator?.id,
    operatorName: j.operator?.name || 'Unassigned',
    tractorId: j.tractor?.id,
    tractorName: j.tractor?.name || '',
    tractorModel: j.tractor?.model || '',
    serviceName: j.service?.name || '',
    landSize: j.landSize,
    scheduledAt: j.scheduledAt
  }));
};

/**
 * Get fleet monitoring status for dashboard
 */
export const getDashboardFleet = async () => {
  const tractors = await prisma.tractor.findMany({
    include: {
      operator: { select: { name: true, availability: true } }
    }
  });

  return tractors.map(t => ({
    id: t.id,
    operator_name: t.operator?.name || 'No Operator',
    tractor_model: t.name,
    status: t.status, // AVAILABLE | IN_USE | MAINTENANCE
    engine_hours: t.engineHours,
    operator_availability: t.operator?.availability || 'unavailable'
  }));
};
/**
 * Get ALL operators for admin management.
 */
export const getAllOperators = async () => {
  console.log(`[AdminService] Fetching all operators for management...`);
  const operators = await prisma.user.findMany({
    where: { role: 'operator' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      availability: true,
      tractor: {
        select: {
          id: true,
          name: true,
          model: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return operators;
};

/**
 * Create a new operator manually (Admin only).
 */
export const createOperator = async (operatorData) => {
  const { name, email, password, phone } = operatorData;

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    throw new Error('Operator with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      role: 'operator',
      status: 'active',
      availability: 'available',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      availability: true,
      createdAt: true,
    },
  });
};

/**
 * Delete an operator profile.
 */
export const deleteOperator = async (id) => {
  return await prisma.user.delete({
    where: { id: parseInt(id) },
  });
};

/**
 * Tractor Management Services
 */

export const getAllTractors = async () => {
  console.log(`[AdminService] Fetching all tractors...`);
  const tractors = await prisma.tractor.findMany({
    include: {
      operator: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Apply Maintenance Logic
  return await Promise.all(tractors.map(async (t) => {
    const hoursRemaining = t.nextServiceDueHours - t.engineHours;
    let currentStatus = t.status;

    // Auto-maintenance rule
    if (hoursRemaining <= 50 && currentStatus !== 'MAINTENANCE') {
      await prisma.tractor.update({
        where: { id: t.id },
        data: { status: 'MAINTENANCE' }
      });
      currentStatus = 'MAINTENANCE';
    }

    return { ...t, status: currentStatus, hoursRemaining };
  }));
};

export const createTractor = async (data) => {
  const { name, model, engineHours = 0, nextServiceDueHours = 250, lastServiceDate } = data;
  return await prisma.tractor.create({
    data: {
      name,
      model,
      engineHours: parseFloat(engineHours),
      nextServiceDueHours: parseFloat(nextServiceDueHours),
      lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : null,
      status: 'AVAILABLE'
    }
  });
};

export const updateTractor = async (id, data) => {
  const tId = parseInt(id);
  const { name, model, status, operatorId, engineHours, nextServiceDueHours, lastServiceDate } = data;

  const tractor = await prisma.tractor.findUnique({ where: { id: tId } });
  if (!tractor) throw new Error('Tractor not found');

  // Business Rule: Do NOT allow assigning tractor in Maintenance
  if (operatorId && status === 'MAINTENANCE') {
    throw new Error('Cannot assign a tractor that is in maintenance');
  }

  const updateData = { name, model, status };
  
  if (engineHours !== undefined) updateData.engineHours = parseFloat(engineHours);
  if (nextServiceDueHours !== undefined) updateData.nextServiceDueHours = parseFloat(nextServiceDueHours);
  if (lastServiceDate !== undefined) updateData.lastServiceDate = lastServiceDate ? new Date(lastServiceDate) : null;

  if (operatorId !== undefined) {
    if (operatorId === null) {
      updateData.operatorId = null;
    } else {
      const opId = parseInt(operatorId);
      // Validate operator
      const operator = await prisma.user.findUnique({ where: { id: opId } });
      if (!operator || operator.role !== 'operator') {
        throw new Error('Invalid operator selected');
      }

      // Handle "Replace old tractor assignment"
      // Since operatorId is unique in Tractor model, we must unlink the old tractor first.
      await prisma.tractor.updateMany({
        where: { operatorId: opId },
        data: { operatorId: null }
      });

      updateData.operatorId = opId;
    }
  }

  return await prisma.tractor.update({
    where: { id: tId },
    data: updateData,
    include: {
      operator: { select: { id: true, name: true } }
    }
  });
};

// Simulation logic removed

/**
 * Finalize USSD booking by fixing location and calculating price.
 * Reuses existing pricing logic to ensure consistency.
 */
export const fixUSSDBooking = async (bookingId, farmerLatitude, farmerLongitude) => {
  const bId = parseInt(bookingId);
  const booking = await prisma.booking.findUnique({
    where: { id: bId },
    include: { service: true }
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.source !== 'USSD') throw new Error('Only USSD bookings can be fixed this way');
  if (booking.locationFixed) throw new Error('Booking location is already fixed');

  // Recalculate price based on new coordinates
  // Service name might be in serviceNameSnapshot (from simulateUSSDBooking) or service.name
  const serviceName = booking.serviceNameSnapshot || booking.service?.name;
  
  const pricing = await calculateBookingPrice(
    serviceName,
    booking.landSize,
    null, // zoneId (calculateBookingPrice handles null and uses lat/lng)
    farmerLatitude,
    farmerLongitude
  );

  return await prisma.booking.update({
    where: { id: bId },
    data: {
      farmerLatitude,
      farmerLongitude,
      basePrice: pricing.basePrice,
      distanceKm: pricing.distanceKm,
      distanceCharge: pricing.distanceCharge,
      fuelSurcharge: pricing.fuelSurcharge,
      totalPrice: pricing.totalPrice,
      finalPrice: pricing.finalPrice,
      zoneName: pricing.zoneName,
      airDistance: pricing.airDistance,
      roadDistance: pricing.roadDistance,
      hubName: pricing.hubName,
      hubLocation: pricing.hubLocation,
      hubLatitude: pricing.hubLatitude,
      hubLongitude: pricing.hubLongitude,
      locationFixed: true
    },
    include: {
      farmer: { select: { name: true, phone: true } },
      service: { select: { name: true } }
    }
  });
};

/**
 * Manually record a cash payment for a USSD booking.
 * Calculates remaining balance and updates payment status accordingly.
 */
export const recordCashPayment = async (bookingId, amount) => {
  const bId = parseInt(bookingId);
  const paymentAmount = parseFloat(amount);

  const booking = await prisma.booking.findUnique({
    where: { id: bId },
    include: { payments: true }
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.source !== 'USSD') throw new Error('Cash recording is only enabled for USSD bookings');

  const currentPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPrice = booking.finalPrice || booking.totalPrice || 0;
  
  if (currentPaid >= (totalPrice - 0.01)) throw new Error('Booking is already fully paid');
  
  const remaining = totalPrice - currentPaid;
  if (paymentAmount > (remaining + 0.01)) throw new Error(`Entered amount exceeding balance (${remaining.toFixed(2)})`);

  // 1. Create Payment record
  await prisma.payment.create({
    data: {
      bookingId: bId,
      amount: paymentAmount,
      method: 'cash',
      status: (currentPaid + paymentAmount) >= (totalPrice - 0.01) ? 'full' : 'partial'
    }
  });

  // 2. Update Booking status
  const newPaidTotal = currentPaid + paymentAmount;
  const newStatus = newPaidTotal >= (totalPrice - 0.01) ? 'PAID' : 'PARTIAL';

  return await prisma.booking.update({
    where: { id: bId },
    data: {
      paymentStatus: newStatus
    },
    include: {
      farmer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      payments: true
    }
  });
};


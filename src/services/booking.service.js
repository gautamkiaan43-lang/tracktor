import prisma from '../config/db.js';

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate booking price based on service rate, land size, and distance calculation.
 * 
 * Formula:
 *   airDistance    = haversine(baseLat, baseLng, farmerLat, farmerLng)
 *   roadDistance   = airDistance * 1.3
 *   Identify matching zone where minDistance <= roadDistance <= maxDistance
 *   distanceCharge = matchedZone.surchargePerHectare * landSize
 *   totalPrice     = serviceCost + distanceCharge
 */
export const calculateBookingPrice = async (serviceType, landSize, zoneId = null, farmerLat = null, farmerLng = null) => {
  // 1. Get service rate
  const service = await prisma.service.findUnique({
    where: { name: serviceType.toLowerCase() }
  });

  if (!service) {
    throw new Error(`Service type '${serviceType}' not found`);
  }

  const baseRate = service.baseRatePerHectare;
  const basePrice = baseRate * landSize;

  // 2. Get fuel config and Coordinates
  let dieselPrice = 0;
  let avgMileage = 1;
  let baseLatitude = null;
  let baseLongitude = null;
  let perKmRate = 500;
  let pricingMode = 'ZONE'; // Default

  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (config) {
      dieselPrice = config.dieselPrice || 0;
      avgMileage = config.avgMileage > 0 ? config.avgMileage : 1;
      baseLatitude = config.baseLatitude;
      baseLongitude = config.baseLongitude;
      perKmRate = (config.perKmRate !== null && config.perKmRate !== undefined) ? config.perKmRate : 500;
      pricingMode = config.pricingMode || 'ZONE';
    }
  } catch (e) {
    console.warn('[BookingService] Could not fetch SystemConfig, using defaults:', e.message);
  }

  const fuelCostPerKm = dieselPrice / avgMileage;

  // 3. Distance Calculations
  const airDistance = haversine(baseLatitude, baseLongitude, farmerLat, farmerLng);
  // Add 1.3 Terrain Factor Client Requirement
  const roadDistance = airDistance > 0 ? airDistance * 1.3 : 0;
  
  // 4. Distance Surcharge — branched by pricing mode
  let distanceCharge = 0;
  let distanceKm = roadDistance;
  let zoneName = "Within Hub Distance (Free)";

  if (pricingMode === 'FUEL') {
    // ─── FUEL-BASED PRICING ─────────────────────────────────────
    // fuel_index = diesel_price / 800
    // per_km_rate = 750 × fuel_index
    // surcharge = per_km_rate × distance × hectares
    if (roadDistance > 0 && dieselPrice > 0) {
      const fuelIndex = dieselPrice / 800;
      const adjustedKmRate = 750 * fuelIndex;
      distanceCharge = parseFloat((adjustedKmRate * roadDistance).toFixed(2));
      zoneName = `${parseFloat(roadDistance.toFixed(1))} KM (Fuel Rate)`;
    }
  } else {
    // ─── ZONE-BASED PRICING (DEFAULT) ───────────────────────────
    if (roadDistance > 0) {
      // Lookup matching zone from database - Only ACTIVE zones
      const allZones = await prisma.zone.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { minDistance: 'asc' }
      });
      
      // Round the roadDistance to seamlessly fall into integer bounds (e.g., 5.5 becomes 6)
      const roundedDistance = Math.round(roadDistance);

      // Find the tier that matches roundedDistance: distance >= min && (max === null || distance <= max)
      const matchedZone = allZones.find(z => 
        roundedDistance >= z.minDistance && (z.maxDistance === null || roundedDistance <= z.maxDistance)
      );
      
      if (matchedZone) {
        zoneName = matchedZone.maxDistance === null ? `${matchedZone.minDistance}+ KM` : `${matchedZone.minDistance}-${matchedZone.maxDistance} KM`;
        distanceCharge = parseFloat((matchedZone.surchargePerHectare * landSize).toFixed(2));
      } else if (allZones.length > 0) {
        // Fallback if no zone matches
        const lastZone = allZones[allZones.length - 1];
        if (roadDistance >= lastZone.minDistance) {
          zoneName = `${lastZone.minDistance}+ KM`;
          distanceCharge = parseFloat((lastZone.surchargePerHectare * landSize).toFixed(2));
        }
      }
    } else if (zoneId) {
       // Backward compatibility for old manual zone dropdown
       const oldZone = await prisma.zone.findUnique({ where: { id: parseInt(zoneId) } });
       if (oldZone) {
         distanceKm = oldZone.minDistance;
         distanceCharge = parseFloat((oldZone.surchargePerHectare * landSize).toFixed(2));
         zoneName = oldZone.maxDistance === null ? `${oldZone.minDistance}+ KM` : `${oldZone.minDistance}-${oldZone.maxDistance} KM`;
       }
    }
  }

  // 5. Calculate charges
  const fuelSurcharge = 0; // kept for schema compatibility
  const totalPrice = parseFloat((basePrice + distanceCharge).toFixed(2));
  const finalPrice = totalPrice;

  return {
    serviceId: service.id,
    basePrice,
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    distanceCharge,
    fuelSurcharge,
    totalPrice,
    finalPrice,
    zoneName,
    airDistance: parseFloat(airDistance.toFixed(2)),
    roadDistance: parseFloat(roadDistance.toFixed(2)),
    pricingMode,
    serviceName: service.name,
    hubName: (await prisma.systemConfig.findUnique({ where: { id: 1 } }))?.hubName || 'Main Hub',
    hubLocation: (await prisma.systemConfig.findUnique({ where: { id: 1 } }))?.hubLocation || 'Ludhiana, Punjab',
    hubLatitude: baseLatitude,
    hubLongitude: baseLongitude
  };
};

/**
 * Create a new booking for a farmer.
 * Optionally creates a Payment record based on paymentOption:
 *   'full'    → Payment record for 100% of totalPrice
 *   'partial' → Payment record for 50% of totalPrice
 *   'later'   → No Payment record (default, cash at hub)
 */
export const createBookingRequest = async (farmerId, bookingData) => {
  const { serviceType, landSize, location, zoneId, farmerLatitude, farmerLongitude, paymentOption, source = 'WEB', locationFixed = true } = bookingData;

  if (paymentOption === 'later') {
    throw new Error('Digital payment is mandatory. Cash payments are no longer supported.');
  }

  const pricing = await calculateBookingPrice(serviceType, landSize, zoneId, farmerLatitude, farmerLongitude);

  const booking = await prisma.booking.create({
    data: {
      farmerId,
      serviceId: pricing.serviceId,
      landSize,
      location,
      basePrice: pricing.basePrice,
      distanceKm: pricing.distanceKm,
      distanceCharge: pricing.distanceCharge,
      fuelSurcharge: pricing.fuelSurcharge,
      totalPrice: pricing.totalPrice,
      finalPrice: pricing.finalPrice,
      zoneName: pricing.zoneName,
      farmerLatitude,
      farmerLongitude,
      airDistance: pricing.airDistance,
      roadDistance: pricing.roadDistance,
      serviceNameSnapshot: pricing.serviceName,
      hubName: pricing.hubName,
      hubLocation: pricing.hubLocation,
      hubLatitude: pricing.hubLatitude,
      hubLongitude: pricing.hubLongitude,
      status: 'PENDING',
      paymentStatus: 'PENDING', // Initial state before payment redirect
      source,
      locationFixed
    },
    include: {
      service: true
    }
  });

  return {
    ...booking,
    paymentOption,
    advancePayment: null // Payments will be handled via the redirect flow
  };
};

/**
 * Creates a booking AND an initial payment record in a single transaction.
 * Used for the new "Pay to Book" flow.
 */
export const createBookingWithInitialPayment = async (farmerId, bookingData) => {
  const { 
    serviceType, 
    landSize, 
    location, 
    zoneId, 
    farmerLatitude, 
    farmerLongitude, 
    paymentOption,
    paymentMethod = 'online',
    source = 'WEB',
    locationFixed = true
  } = bookingData;

  if (paymentOption === 'later') {
    throw new Error('Digital payment is required for initial booking.');
  }

  // 1. Calculate pricing
  const pricing = await calculateBookingPrice(serviceType, landSize, zoneId, farmerLatitude, farmerLongitude);

  // 2. Determine payment amount and status
  const totalAmount = pricing.totalPrice;
  const paymentAmount = paymentOption === 'full' ? totalAmount : totalAmount * 0.5;
  const finalPaymentStatus = paymentOption === 'full' ? 'PAID' : 'PARTIAL';

  // 3. Execute Transaction
  return await prisma.$transaction(async (tx) => {
    // A. Create Booking
    const booking = await tx.booking.create({
      data: {
        farmerId,
        serviceId: pricing.serviceId,
        landSize,
        location,
        basePrice: pricing.basePrice,
        distanceKm: pricing.distanceKm,
        distanceCharge: pricing.distanceCharge,
        fuelSurcharge: pricing.fuelSurcharge,
        totalPrice: pricing.totalPrice,
        finalPrice: pricing.finalPrice,
        zoneName: pricing.zoneName,
        farmerLatitude,
        farmerLongitude,
        airDistance: pricing.airDistance,
        roadDistance: pricing.roadDistance,
        serviceNameSnapshot: pricing.serviceName,
        hubName: pricing.hubName,
        hubLocation: pricing.hubLocation,
        hubLatitude: pricing.hubLatitude,
        hubLongitude: pricing.hubLongitude,
        status: 'PENDING',
        paymentStatus: finalPaymentStatus,
        source,
        locationFixed
      },
      include: {
        service: true
      }
    });

    // B. Create Payment Record
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: parseFloat(paymentAmount.toFixed(2)),
        method: paymentMethod,
        status: 'full' // This specific payment record is considered "full" for the amount paid
      }
    });

    return {
      ...booking,
      paidAmount: paymentAmount
    };
  });
};

/**
 * Get all bookings for a specific farmer.
 */
export const getFarmerBookings = async (farmerId, query = {}) => {
  const { page = 1, limit = 6, status = 'all', search } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = { farmerId };

  if (status && status !== 'all') {
    // Support multiple statuses if provided as a comma-separated string or array
    const statusArray = Array.isArray(status) 
      ? status 
      : status.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '_'));
    
    if (statusArray.length > 1) {
      where.status = { in: statusArray };
    } else if (statusArray.length === 1) {
      where.status = statusArray[0];
    }
  }

  if (search) {
    const searchInt = parseInt(search);
    where.OR = [
      { service: { name: { contains: search } } },
      { serviceNameSnapshot: { contains: search } }
    ];
    if (!isNaN(searchInt)) {
      where.OR.push({ id: searchInt });
    }
  }

  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        service: true,
        payments: true
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.booking.count({ where })
  ]);

  return {
    bookings,
    pagination: {
      totalCount,
      totalPages: Math.ceil(totalCount / take),
      currentPage: parseInt(page),
      limit: take
    }
  };
};

/**
 * Get booking details by ID.
 */
export const getBookingById = async (bookingId, farmerId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) },
    include: {
      service: true
    }
  });

  if (!booking || booking.farmerId !== farmerId) {
    return null;
  }

  return booking;
};


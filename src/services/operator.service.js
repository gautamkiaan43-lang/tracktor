import prisma from '../config/db.js';

const allowedTransitions = {
  SCHEDULED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [] // Terminal state - payment handled separately via paymentStatus
};

// Returns operator specific jobs split into current and queue
export const getOperatorJobs = async (operatorId) => {
  const jobs = await prisma.booking.findMany({
    where: { operatorId: parseInt(operatorId) },
    include: {
      farmer: { select: { name: true, phone: true } },
      service: { select: { name: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Current job is anything that is active (ASSIGNED or IN_PROGRESS)
  const currentJob = jobs.find(j => ['ASSIGNED', 'IN_PROGRESS'].includes(j.status?.toUpperCase()));
  // Queue is all other assigned or scheduled jobs
  const queue = jobs.filter(j => ['ASSIGNED', 'SCHEDULED'].includes(j.status?.toUpperCase()) && j.id !== currentJob?.id);

  return {
    current_job: currentJob || null,
    queue: queue
  };
};

export const getOperatorStats = async (operatorId) => {
  // Calculate total hectares from completed bookings
  const completedStats = await prisma.booking.aggregate({
    where: {
      operatorId: parseInt(operatorId),
      status: 'COMPLETED'
    },
    _sum: {
      landSize: true
    }
  });

  // Calculate Fuel Efficiency
  const fuelStats = await prisma.fuelLog.aggregate({
    where: { operatorId: parseInt(operatorId) },
    _sum: { liters: true }
  });

  const totalHectares = completedStats._sum.landSize || 0;
  const totalLiters = fuelStats._sum.liters || 0;
  
  // L/HA
  let efficiency = 0;
  if (totalHectares > 0) {
    efficiency = totalLiters / totalHectares;
  }

  // Get Tractor Data
  const tractor = await prisma.tractor.findFirst({
    where: { operatorId: parseInt(operatorId) }
  });

  let engineHours = 0;
  let unitHealth = 100;
  
  if (tractor) {
    engineHours = tractor.engineHours;
    if (tractor.nextServiceDueHours > 0) {
       unitHealth = Math.max(0, 100 - (tractor.engineHours / tractor.nextServiceDueHours) * 100);
    }
  }

  const totalJobs = await prisma.booking.count({
    where: { operatorId: parseInt(operatorId) }
  });

  return {
    hectares_done: totalHectares,
    total_jobs: totalJobs,
    engine_hours: parseFloat(engineHours.toFixed(1)),   
    unit_health: Math.round(unitHealth)
  };
};

export const updateJobStatus = async (operatorId, bookingId, nextStatus) => {
  // 1. Fetch existing booking
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) }
  });

  if (!booking) {
    throw new Error('NOT_FOUND: Booking does not exist');
  }

  // 2. Validate Operator Ownership
  if (booking.operatorId !== parseInt(operatorId)) {
    throw new Error('FORBIDDEN: You do not have permission to update this booking');
  }

  // 3. Idempotency Check
  if (booking.status === nextStatus) {
    return booking; // Already at the requested status
  }

  const currentAllowed = allowedTransitions[booking.status?.toUpperCase()] || [];
  if (!currentAllowed.includes(nextStatus?.toUpperCase())) {
    throw new Error(`INVALID_TRANSITION: Cannot transition from ${booking.status} to ${nextStatus}`);
  }

  // 5. Transaction or Standard Update depending on target state
  if (nextStatus?.toUpperCase() === 'COMPLETED') {
    // Requires transaction to free resources
    const [updatedBooking] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' }
      }),
      prisma.user.update({
        where: { id: booking.operatorId },
        data: { availability: 'available' }
      }),
      prisma.tractor.update({
        where: { id: booking.tractorId },
        data: { status: 'AVAILABLE' }
      })
    ]);
    return updatedBooking;
  } else {
    // Normal progress update (en_route, in_progress)
    return await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus.toUpperCase().replace(/\s+/g, '_') }
    });
  }
};

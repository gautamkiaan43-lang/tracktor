import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFuelLogs = async (filters) => {
  const { operatorId, tractorId, status, startDate, endDate } = filters;
  
  const where = {};
  if (operatorId) where.operatorId = parseInt(operatorId);
  if (tractorId) where.tractorId = parseInt(tractorId);
  if (status) where.status = status;
  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  return await prisma.fuelLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      operator: {
        select: { id: true, name: true, phone: true }
      },
      tractor: {
        select: { id: true, name: true, model: true }
      },
      reviewer: {
        select: { id: true, name: true }
      }
    }
  });
};

export const getFuelLogsKPI = async (filters) => {
  const { operatorId, tractorId, startDate, endDate } = filters;
  
  const where = {};
  if (operatorId) where.operatorId = parseInt(operatorId);
  if (tractorId) where.tractorId = parseInt(tractorId);
  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const logs = await prisma.fuelLog.findMany({
    where,
    include: {
      tractor: { select: { id: true, name: true } }
    }
  });

  let totalEntries = 0;
  let totalCost = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const tractorUsage = {};

  logs.forEach(log => {
    totalEntries++;
    totalCost += log.cost;
    if (log.status === 'APPROVED') approvedCount++;
    if (log.status === 'REJECTED') rejectedCount++;

    if (log.tractor) {
        if (!tractorUsage[log.tractor.id]) {
            tractorUsage[log.tractor.id] = {
                name: log.tractor.name,
                totalLiters: 0,
                totalCost: 0
            };
        }
        tractorUsage[log.tractor.id].totalLiters += log.liters;
        tractorUsage[log.tractor.id].totalCost += log.cost;
    }
  });

  return {
    totalEntries,
    totalCost,
    approvedCount,
    rejectedCount,
    tractorUsage: Object.values(tractorUsage)
  };
};

export const updateFuelLogStatus = async (id, status, adminId) => {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new Error('Invalid status');
  }

  const log = await prisma.fuelLog.findUnique({ where: { id: parseInt(id) } });
  if (!log) throw new Error('Fuel log not found');
  if (log.status !== 'PENDING') throw new Error('Only PENDING logs can be updated');

  return await prisma.fuelLog.update({
    where: { id: parseInt(id) },
    data: {
      status,
      reviewedBy: parseInt(adminId),
      reviewedAt: new Date()
    },
    include: {
      operator: { select: { name: true } },
      tractor: { select: { name: true } }
    }
  });
};

export const getFuelAnalytics = async (filters = {}) => {
  const { operatorId, tractorId, startDate, endDate, range } = filters;
  
  const where = {};
  if (operatorId) where.operatorId = parseInt(operatorId);
  if (tractorId) where.tractorId = parseInt(tractorId);
  
  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  } else if (range) {
    const end = new Date();
    const start = new Date();
    if (range === '7d') start.setDate(end.getDate() - 7);
    if (range === '30d') start.setDate(end.getDate() - 30);
    if (range === '1y') start.setFullYear(end.getFullYear() - 1);
    where.createdAt = {
      gte: start,
      lte: end
    };
  }

  const logs = await prisma.fuelLog.findMany({
    where,
    include: {
      tractor: { select: { id: true, name: true } }
    }
  });

  let totalEntries = 0;
  let totalCost = 0;
  let totalFuel = 0;
  const tractorWiseMap = {};

  logs.forEach(log => {
    totalEntries++;
    totalCost += log.cost;
    totalFuel += log.liters;

    if (log.tractor) {
        if (!tractorWiseMap[log.tractor.id]) {
            tractorWiseMap[log.tractor.id] = {
                tractorName: log.tractor.name,
                totalFuel: 0,
                totalCost: 0
            };
        }
        tractorWiseMap[log.tractor.id].totalFuel += log.liters;
        tractorWiseMap[log.tractor.id].totalCost += log.cost;
    }
  });

  return {
    totalFuel,
    totalCost,
    totalEntries,
    tractorWise: Object.values(tractorWiseMap).sort((a, b) => b.totalFuel - a.totalFuel)
  };
};

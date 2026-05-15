import prisma from '../config/db.js';

// ─── SYSTEM CONFIGURATION (Singleton) ────────────────────────────

/**
 * Get system configuration. Creates default if not exists.
 */
export const getSystemConfig = async () => {
  let config = await prisma.systemConfig.findUnique({ where: { id: 1 } });

  if (!config) {
    config = await prisma.systemConfig.create({
      data: { id: 1 }
    });
  }

  return {
    // General
    hubName: config.hubName,
    hubLocation: config.hubLocation,
    supportEmail: config.supportEmail,
    contactEmail: config.contactEmail,
    // Hub Coordinates
    baseLatitude: config.baseLatitude,
    baseLongitude: config.baseLongitude,
    // Fuel
    dieselPrice: config.dieselPrice,
    avgMileage: config.avgMileage,
    fuelCostPerKm: config.avgMileage > 0
      ? parseFloat((config.dieselPrice / config.avgMileage).toFixed(2))
      : 0,
    // Maintenance
    serviceIntervalHours: config.serviceIntervalHours,
    preAlertHours: config.preAlertHours,
    updatedAt: config.updatedAt
  };
};

/**
 * Update system configuration.
 * Logs diesel price changes if adminId is provided.
 */
export const updateSystemConfig = async (data, adminId = null) => {
  const currentConfig = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  const oldPrice = currentConfig ? currentConfig.dieselPrice : 0;
  
  const updatePayload = {};
  if (data.hubName !== undefined) updatePayload.hubName = data.hubName;
  if (data.hubLocation !== undefined) updatePayload.hubLocation = data.hubLocation;
  if (data.supportEmail !== undefined) updatePayload.supportEmail = data.supportEmail;
  if (data.contactEmail !== undefined) updatePayload.contactEmail = data.contactEmail;
  if (data.dieselPrice !== undefined) updatePayload.dieselPrice = parseFloat(data.dieselPrice);
  if (data.avgMileage !== undefined) updatePayload.avgMileage = data.avgMileage;
  if (data.serviceIntervalHours !== undefined) updatePayload.serviceIntervalHours = data.serviceIntervalHours;
  if (data.preAlertHours !== undefined) updatePayload.preAlertHours = data.preAlertHours;
  if (data.baseLatitude !== undefined) updatePayload.baseLatitude = data.baseLatitude;
  if (data.baseLongitude !== undefined) updatePayload.baseLongitude = data.baseLongitude;
  if (data.perKmRate !== undefined) updatePayload.perKmRate = data.perKmRate;
  if (data.pricingMode !== undefined && ['ZONE', 'FUEL'].includes(data.pricingMode)) {
    updatePayload.pricingMode = data.pricingMode;
  }

  const config = await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: updatePayload,
    create: { id: 1, ...updatePayload }
  });

  // Log fuel price change if it happened and adminId is available
  if (data.dieselPrice !== undefined && adminId && Math.abs(oldPrice - updatePayload.dieselPrice) > 0.001) {
    await prisma.fuelPriceLog.create({
      data: {
        oldPrice: oldPrice,
        newPrice: updatePayload.dieselPrice,
        adminId: parseInt(adminId)
      }
    });
  }

  return {
    ...config,
    fuelCostPerKm: config.avgMileage > 0 
      ? parseFloat((config.dieselPrice / config.avgMileage).toFixed(2))
      : 0
  };
};

/**
 * Get fuel price adjustment logs.
 */
export const getFuelPriceLogs = async () => {
  return await prisma.fuelPriceLog.findMany({
    orderBy: { timestamp: 'desc' }
  });
};


// ─── DISTANCE ZONES ──────────────────────────────────────────────

/**
 * List all zones. Returns all zones for admin management.
 */
export const listZones = async () => {
  return await prisma.zone.findMany({
    orderBy: { minDistance: 'asc' }
  });
};

/**
 * Get a single zone by ID.
 */
export const getZoneById = async (id) => {
  const zone = await prisma.zone.findUnique({ where: { id: parseInt(id) } });
  if (!zone) throw new Error('Zone not found');
  return zone;
};

/**
 * Validates zone ranges for overlaps, gaps, and open-ended constraints.
 */
const validateZones = async (newZone, excludeId = null) => {
  const allActiveZones = await prisma.zone.findMany({
    where: { 
      status: 'ACTIVE',
      id: excludeId ? { not: excludeId } : undefined
    },
    orderBy: { minDistance: 'asc' }
  });

  const zones = [...allActiveZones, newZone].sort((a, b) => a.minDistance - b.minDistance);

  // 1. Only one open-ended zone allowed
  const openEnded = zones.filter(z => z.maxDistance === null);
  if (openEnded.length > 1) {
    throw new Error('Only one open-ended zone (max distance as NULL) is allowed.');
  }
  if (openEnded.length === 1 && zones[zones.length - 1].maxDistance !== null) {
    throw new Error('Distance Conflict: An active open-ended zone (e.g., "41+ KM") exists, but there are other zones starting at a higher distance. The open-ended zone must always be the final tier.');
  }

  // 2. Check for overlaps and gaps
  for (let i = 0; i < zones.length - 1; i++) {
    const current = zones[i];
    const next = zones[i + 1];

    if (current.maxDistance === null) {
      throw new Error(`Logical Error: Zone "${current.minDistance}+ KM" is open-ended and cannot be followed by another zone ("${next.minDistance} KM").`);
    }

    if (current.maxDistance > next.minDistance) {
      throw new Error(`Overlap detected: Zone (${current.minDistance}-${current.maxDistance}) overlaps with (${next.minDistance}-${next.maxDistance || '+'})`);
    }
  }
};

/**
 * Create a new zone.
 */
export const createZone = async (minDistance, maxDistance, surchargePerHectare, status = 'ACTIVE') => {
  const min = parseFloat(minDistance);
  const max = maxDistance !== null && maxDistance !== undefined && maxDistance !== '' ? parseFloat(maxDistance) : null;
  const surcharge = parseFloat(surchargePerHectare);
  const newStatus = status || 'ACTIVE';

  if (isNaN(min) || min < 0) throw new Error('Minimum distance must be a valid non-negative number');
  if (max !== null && (isNaN(max) || max <= min)) throw new Error('Maximum distance must be greater than minimum distance');
  if (isNaN(surcharge) || surcharge < 0) throw new Error('Surcharge must be zero or a positive number');

  // Auto-generate ID: max(id) + 1
  const maxIdZone = await prisma.zone.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  const nextId = maxIdZone ? maxIdZone.id + 1 : 0;

  const newZone = { minDistance: min, maxDistance: max, surchargePerHectare: surcharge, status: newStatus };
  
  if (newStatus === 'ACTIVE') {
    await validateZones(newZone);
  }

  return await prisma.zone.create({
    data: { 
      id: nextId,
      minDistance: min,
      maxDistance: max, 
      surchargePerHectare: surcharge,
      status: newStatus
    }
  });
};

/**
 * Update an existing zone.
 */
export const updateZone = async (id, minDistance, maxDistance, surchargePerHectare, status) => {
  const zone = await prisma.zone.findUnique({ where: { id: parseInt(id) } });
  if (!zone) throw new Error('Zone not found');

  const data = {};
  if (status !== undefined) data.status = status;
  
  const newMin = minDistance !== undefined ? parseFloat(minDistance) : zone.minDistance;
  const newMax = maxDistance !== undefined ? (maxDistance === null || maxDistance === '' ? null : parseFloat(maxDistance)) : zone.maxDistance;
  const newStatus = status !== undefined ? status : zone.status;
  
  if (minDistance !== undefined || maxDistance !== undefined || status !== undefined) {
    if (newMax !== null && newMax <= newMin) throw new Error('Maximum distance must be greater than minimum distance');
    if (newMin < 0) throw new Error('Minimum distance cannot be negative');
    
    if (newStatus === 'ACTIVE') {
      const pendingZone = { minDistance: newMin, maxDistance: newMax, status: 'ACTIVE' };
      await validateZones(pendingZone, parseInt(id));
    }
    
    if (minDistance !== undefined) data.minDistance = newMin;
    if (maxDistance !== undefined) data.maxDistance = newMax;
  }

  if (surchargePerHectare !== undefined) {
    const surcharge = parseFloat(surchargePerHectare);
    if (isNaN(surcharge) || surcharge < 0) throw new Error('Surcharge must be zero or a positive number');
    data.surchargePerHectare = surcharge;
  }

  return await prisma.zone.update({
    where: { id: parseInt(id) },
    data
  });
};

/**
 * Delete a zone (Soft Delete).
 */
export const deleteZone = async (id) => {
  const zone = await prisma.zone.findUnique({ where: { id: parseInt(id) } });
  if (!zone) throw new Error('Zone not found');

  await prisma.zone.update({ 
    where: { id: parseInt(id) },
    data: { status: 'INACTIVE' }
  });
  return { success: true };
};

/**
 * Update a single service rate, effective date, and status.
 */
export const updateService = async (id, data) => {
  const serviceId = parseInt(id);
  const updatePayload = {};

  if (data.baseRatePerHectare !== undefined) {
    const baseRate = parseFloat(data.baseRatePerHectare);
    if (isNaN(baseRate) || baseRate <= 0) throw new Error('Service rate must be a positive number');
    updatePayload.baseRatePerHectare = baseRate;
  }

  if (data.effectiveDate) {
    updatePayload.effectiveDate = new Date(data.effectiveDate);
  }

  if (data.isActive !== undefined) {
    updatePayload.isActive = data.isActive;
  }

  return await prisma.service.update({
    where: { id: serviceId },
    data: updatePayload
  });
};

/**
 * Update service rates in bulk.
 */
export const updateServiceRates = async (ratesMap) => {
  const updatedServices = [];
  for (const [name, rate] of Object.entries(ratesMap)) {
    const rawName = name.toLowerCase();
    const service = await prisma.service.findUnique({ where: { name: rawName } });
    if (service) {
      const updated = await prisma.service.update({
        where: { name: rawName },
        data: { baseRatePerHectare: parseFloat(rate) }
      });
      updatedServices.push(updated);
    }
  }
  return updatedServices;
};

/**
 * List all available services and their rates.
 */
export const listServices = async () => {
  return await prisma.service.findMany({
    where: { isDeleted: false },
    orderBy: { name: 'asc' }
  });
};

/**
 * Delete a service (Soft Delete).
 */
export const deleteService = async (id) => {
  const serviceId = parseInt(id);
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error('Service not found');

  return await prisma.service.update({
    where: { id: serviceId },
    data: { isDeleted: true, isActive: false }
  });
};


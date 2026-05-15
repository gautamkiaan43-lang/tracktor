import prisma from '../config/db.js';

/**
 * List all USSD locations for admin management.
 */
export const adminListAll = async () => {
  return await prisma.ussdLocation.findMany({
    orderBy: { name: 'asc' }
  });
};

/**
 * Create a new USSD location.
 * Validates active limit (6-8).
 */
export const create = async (data) => {
  const { name, chargePerHectare, isActive } = data;

  if (!name || name.trim() === '') throw new Error('Location name is required');
  if (chargePerHectare === undefined || chargePerHectare < 0) throw new Error('Valid charge per hectare is required');

  if (isActive) {
    const activeCount = await prisma.ussdLocation.count({ where: { isActive: true } });
    if (activeCount >= 8) {
      throw new Error('Limit reached: Only up to 8 active locations are allowed for USSD accessibility.');
    }
  }

  return await prisma.ussdLocation.create({
    data: {
      name: name.trim(),
      chargePerHectare: parseFloat(chargePerHectare),
      isActive: isActive !== undefined ? isActive : true
    }
  });
};

/**
 * Update an existing USSD location.
 * Validates active limit (6-8) if being activated.
 */
export const update = async (id, data) => {
  const locationId = parseInt(id);
  const existing = await prisma.ussdLocation.findUnique({ where: { id: locationId } });
  if (!existing) throw new Error('USSD Location not found');

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.chargePerHectare !== undefined) updateData.chargePerHectare = parseFloat(data.chargePerHectare);
  
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
    
    // If we are activating a location that was previously inactive
    if (data.isActive === true && existing.isActive === false) {
      const activeCount = await prisma.ussdLocation.count({ where: { isActive: true } });
      if (activeCount >= 8) {
        throw new Error('Limit reached: Only up to 8 active locations are allowed. Deactivate another before activating this one.');
      }
    }
  }

  return await prisma.ussdLocation.update({
    where: { id: locationId },
    data: updateData
  });
};

/**
 * Delete a USSD location.
 */
export const remove = async (id) => {
  const locationId = parseInt(id);
  return await prisma.ussdLocation.delete({
    where: { id: locationId }
  });
};

/**
 * Get active locations for the USSD system.
 * Limited to 8 results.
 */
export const getActiveLocations = async () => {
  return await prisma.ussdLocation.findMany({
    where: { isActive: true },
    take: 8,
    orderBy: { name: 'asc' }
  });
};

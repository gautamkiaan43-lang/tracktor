import prisma from '../../config/db.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * List all available services and their rates.
 */
export const listServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: { name: 'asc' }
    });
    return sendSuccess(res, services, "Services retrieved successfully");
  } catch (error) {
    return sendError(res, error.message);
  }
};

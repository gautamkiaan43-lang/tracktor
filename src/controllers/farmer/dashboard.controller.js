import * as farmerService from '../../services/farmer.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * Get aggregated dashboard metrics for the farmer
 */
export const getDashboard = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const metrics = await farmerService.getDashboardMetrics(farmerId);
    return sendSuccess(res, metrics, "Farmer dashboard metrics retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get recent activity for the farmer
 */
export const getRecentActivity = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const activity = await farmerService.getRecentActivity(farmerId);
    return sendSuccess(res, activity, "Farmer recent activity retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get upcoming jobs for the farmer
 */
export const getUpcomingJobs = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const jobs = await farmerService.getUpcomingJobs(farmerId);
    return sendSuccess(res, jobs, "Farmer upcoming jobs retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

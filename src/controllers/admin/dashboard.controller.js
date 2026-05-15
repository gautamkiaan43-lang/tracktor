import * as adminService from '../../services/admin.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Get aggregated dashboard metrics
 */
export const getMetrics = async (req, res) => {
  try {
    const metrics = await adminService.getDashboardMetrics();
    const responseData = {
      ...metrics,
      totalRevenueFormatted: formatCurrency(metrics.totalRevenue),
      avgBookingValueFormatted: formatCurrency(metrics.avgBookingValue),
      thisMonthEarningsFormatted: formatCurrency(metrics.thisMonthEarnings)
    };
    return sendSuccess(res, responseData, "Dashboard metrics retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get assignment queue for dashboard
 */
export const getAssignmentQueue = async (req, res) => {
  try {
    const queue = await adminService.getDashboardAssignmentQueue();
    return sendSuccess(res, queue, "Assignment queue retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get revenue analytics for dashboard chart
 */
export const getRevenue = async (req, res) => {
  try {
    const { timeframe } = req.query; // 'hourly', 'daily', 'weekly'
    const revenue = await adminService.getDashboardRevenue(timeframe);
    return sendSuccess(res, revenue, "Dashboard revenue retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get fleet monitoring status for dashboard
 */
export const getFleet = async (req, res) => {
  try {
    const fleet = await adminService.getDashboardFleet();
    return sendSuccess(res, fleet, "Dashboard fleet retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get all active jobs for admin tracking map
 */
export const getActiveJobs = async (req, res) => {
  try {
    const jobs = await adminService.getActiveJobs();
    return sendSuccess(res, jobs, "Active jobs retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

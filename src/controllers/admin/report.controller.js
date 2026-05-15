import * as reportService from '../../services/report.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * Get revenue analytics report
 */
export const getRevenue = async (req, res) => {
  try {
    const { range } = req.query; // '7d', '30d', '1y'
    const report = await reportService.getRevenueReport(range);
    return sendSuccess(res, report, "Revenue report retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get service usage analytics report
 */
export const getServiceUsage = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getServiceUsageReport(range);
    return sendSuccess(res, report, "Service usage report retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get fleet monitoring analytics report
 */
export const getFleet = async (req, res) => {
  try {
    const report = await reportService.getFleetReport();
    return sendSuccess(res, report, "Fleet report retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get farmer growth analytics report
 */
export const getFarmers = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getFarmerGrowthReport(range);
    return sendSuccess(res, report, "Farmer growth report retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get bookings analytics
 */
export const getBookingsAnalytics = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getBookingsAnalytics(range);
    return sendSuccess(res, report, "Bookings analytics retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get operator performance report
 */
export const getOperatorPerformance = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getOperatorPerformance(range);
    return sendSuccess(res, report, "Operator performance report retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get job status distribution
 */
export const getJobStatusDistribution = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getJobStatusDistribution(range);
    return sendSuccess(res, report, "Job status distribution retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get tractor wise profitability report
 */
export const getTractorProfitability = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getTractorProfitabilityReport(range);
    return sendSuccess(res, report, "Tractor profitability retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get raw data for export
 */
export const getExportData = async (req, res) => {
  try {
    const { range } = req.query;
    const report = await reportService.getExportData(range);
    return sendSuccess(res, report, "Export data retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

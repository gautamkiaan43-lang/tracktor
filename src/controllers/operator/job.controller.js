import * as operatorService from '../../services/operator.service.js';
import NotificationService from '../../services/notification.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const getJobs = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const jobsData = await operatorService.getOperatorJobs(operatorId);
    return sendSuccess(res, jobsData, 'Operator jobs fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500, 'FETCH_JOBS_ERROR');
  }
};

export const getStats = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const stats = await operatorService.getOperatorStats(operatorId);
    return sendSuccess(res, stats, 'Operator stats fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500, 'FETCH_STATS_ERROR');
  }
};

export const updateStatus = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { id: bookingId } = req.params; // Changed from bookingId to id for route match
    const { status } = req.body;

    if (!status) {
      return sendError(res, 'Status is required in the request body', 400, 'VALIDATION_ERROR');
    }

    const updatedBooking = await operatorService.updateJobStatus(operatorId, bookingId, status);
    
    // Notification for Job Completion
    if (status?.toUpperCase() === 'COMPLETED' && updatedBooking) {
      const io = req.app.get('io');
      
      // Notify Farmer
      NotificationService.notifyUser(io, updatedBooking.farmerId, 'farmer', {
        message: "Your job has been completed successfully",
        type: "tracking",
        metadata: { bookingId: updatedBooking.id }
      });

      // Notify Admin
      NotificationService.notifyAdmins(io, {
        message: `Job #${updatedBooking.id} completed by operator`,
        type: "tracking",
        metadata: { bookingId: updatedBooking.id, operatorId }
      });
    }

    return sendSuccess(res, updatedBooking, 'Booking status updated successfully');
  } catch (error) {
    let statusCode = 400;
    let errorCode = 'UPDATE_ERROR';

    if (error.message.includes('NOT_FOUND')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (error.message.includes('FORBIDDEN')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    } else if (error.message.includes('INVALID_TRANSITION')) {
      statusCode = 400;
      errorCode = 'INVALID_TRANSITION';
    }

    return sendError(res, error.message, statusCode, errorCode);
  }
};

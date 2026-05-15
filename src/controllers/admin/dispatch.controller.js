import * as adminService from '../../services/admin.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const getPendingBookings = async (req, res) => {
  try {
    const status = req.query.status;
    if (status && status !== 'scheduled') {
      return sendSuccess(res, [], "Only scheduled bookings are supported in this endpoint.");
    }
    const bookings = await adminService.getPendingBookings();
    return sendSuccess(res, bookings, "Pending bookings retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500, "FETCH_BOOKINGS_FAILED");
  }
};

export const getAvailableOperators = async (req, res) => {
  try {
    const operators = await adminService.getAvailableOperators();
    return sendSuccess(res, operators, "Available operators retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500, "FETCH_OPERATORS_FAILED");
  }
};

export const dispatchBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { operatorId } = req.body;

    if (!operatorId) {
      return sendError(res, "operatorId is required", 400, "VALIDATION_ERROR");
    }

    const booking = await adminService.assignOperator(bookingId, operatorId);
    const broadcastFarmerDestination = req.app.get('broadcastFarmerDestination');
    if (broadcastFarmerDestination && Number.isFinite(booking?.farmerLatitude) && Number.isFinite(booking?.farmerLongitude)) {
      broadcastFarmerDestination(booking.farmerLatitude, booking.farmerLongitude, 'default-room');
    }
    return sendSuccess(res, booking, "Booking dispatched successfully");
  } catch (error) {
    const statusCode = error.message.includes('NOT_FOUND') || error.message.includes('not found') ? 404 : 400;
    const errorCode = error.message.includes('INVALID_TRANSITION') ? 'INVALID_TRANSITION' : 'DISPATCH_ERROR';
    return sendError(res, error.message, statusCode, errorCode);
  }
};

export const scheduleBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { scheduledDate } = req.body;

    if (!scheduledDate) {
      return sendError(res, "scheduledDate is required", 400, "VALIDATION_ERROR");
    }

    const booking = await adminService.scheduleBooking(bookingId, scheduledDate);
    return sendSuccess(res, booking, "Booking scheduled successfully");
  } catch (error) {
    const statusCode = error.message.includes('NOT_FOUND') || error.message.includes('not found') ? 404 : 400;
    const errorCode = error.message.includes('INVALID_TRANSITION') ? 'INVALID_TRANSITION' : 'SCHEDULE_ERROR';
    return sendError(res, error.message, statusCode, errorCode);
  }
};

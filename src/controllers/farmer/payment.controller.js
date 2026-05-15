import * as PaymentService from '../../services/payment.service.js';
import NotificationService from '../../services/notification.service.js';
import prisma from '../../config/db.js';
import { sendSuccess, sendError } from '../../utils/response.js';

/**
 * Get all pending/unpaid bookings for the farmer.
 */
export const getPendingBookings = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const result = await PaymentService.getFarmerPendingBookings(farmerId);
    return sendSuccess(res, result, "Pending bookings retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get payment history for the logged-in farmer.
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const history = await PaymentService.getFarmerPaymentHistory(farmerId);
    return sendSuccess(res, history, "Payment history retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Process payment for an individual booking.
 */
export const payBooking = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { bookingId, amount, method } = req.body;

    if (!bookingId || !amount) {
      return sendError(res, "bookingId and amount are required", 400, "VALIDATION_ERROR");
    }

    const payment = await PaymentService.processBookingPayment(farmerId, { bookingId, amount, method });
    
    // Trigger Notifications for Payment
    try {
      const io = req.app.get('io');
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(bookingId) },
        select: { id: true, paymentStatus: true }
      });

      const isFull = booking?.paymentStatus === 'PAID';
      const statusTitle = isFull ? "Full payment completed" : "Partial payment received";

      // Notify Farmer
      NotificationService.notifyUser(io, farmerId, 'farmer', {
        message: `Your payment was recorded: ${statusTitle}`,
        type: "payment",
        metadata: { bookingId: booking.id, amount, isFull }
      });

      // Notify Admins
      NotificationService.notifyAdmins(io, {
        message: `Payment received from farmer: ${statusTitle}`,
        type: "payment",
        metadata: { bookingId: booking.id, amount, farmerId, isFull }
      });
    } catch (notifyError) {
      console.error('[PaymentController] Notification Error:', notifyError);
    }

    return sendSuccess(res, payment, "Payment processed successfully", 201);
  } catch (error) {
    const statusCode = error.message.includes('NOT_FOUND') ? 404 : 
                      error.message.includes('FORBIDDEN') ? 403 : 400;
    return sendError(res, error.message, statusCode);
  }
};

/**
 * Settle all outstanding dues for the farmer.
 */
export const settleAll = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const result = await PaymentService.settleAllDues(farmerId);
    return sendSuccess(res, result, "Bulk settlement completed");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

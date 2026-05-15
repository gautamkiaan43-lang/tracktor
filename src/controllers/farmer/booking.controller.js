import * as BookingService from '../../services/booking.service.js';
import NotificationService from '../../services/notification.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { bookingCreateSchema, pricePreviewSchema } from '../../schema/booking.schema.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Handle price preview request.
 */
export const getPricePreview = async (req, res) => {
  try {
    const validatedData = pricePreviewSchema.parse(req.body);
    const pricing = await BookingService.calculateBookingPrice(
      validatedData.serviceType,
      validatedData.landSize,
      validatedData.zoneId,
      validatedData.farmerLatitude,
      validatedData.farmerLongitude
    );
    return sendSuccess(res, {
      basePrice: pricing.basePrice,
      distanceKm: pricing.distanceKm,
      distanceCharge: pricing.distanceCharge,
      fuelSurcharge: pricing.fuelSurcharge,
      totalPrice: pricing.totalPrice,
      formattedTotalPrice: formatCurrency(pricing.totalPrice),
      formattedDistanceCharge: pricing.distanceCharge > 0 ? formatCurrency(pricing.distanceCharge) : "Included",
      zoneName: pricing.zoneName,
      airDistance: pricing.airDistance,
      roadDistance: pricing.roadDistance
    }, "Price preview calculated");
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    return sendError(res, error.message, 400);
  }
};

/**
 * Handle new booking creation.
 */
export const createBooking = async (req, res) => {
  try {
    const validatedData = bookingCreateSchema.parse(req.body);
    const farmerId = req.user.id;
    const booking = await BookingService.createBookingRequest(farmerId, validatedData);
    
    // Add formatted total price for USSD/JSON consumers
    const formattedBooking = {
      ...booking,
      formattedTotalPrice: formatCurrency(booking.totalPrice)
    };
    
    // Trigger Admin Notification (Async - non-blocking)
    const io = req.app.get('io');
    NotificationService.notifyAdmins(io, {
      message: "New booking request received",
      type: "booking",
      metadata: { bookingId: booking.id, farmerId }
    });
    
    return sendSuccess(res, formattedBooking, "Booking scheduled successfully", 201);
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    return sendError(res, error.message, 500);
  }
};

/**
 * Atomic checkout for a new booking with simulation of successful payment.
 */
export const checkout = async (req, res) => {
  try {
    const validatedData = bookingCreateSchema.parse(req.body);
    const farmerId = req.user.id;
    
    // Simulate successful payment validation here
    // In a real flow, you would verify a gateway transaction reference.
    
    const result = await BookingService.createBookingWithInitialPayment(farmerId, validatedData);
    
    const formattedBooking = {
      ...result,
      formattedTotalPrice: formatCurrency(result.totalPrice),
      formattedPaidAmount: formatCurrency(result.paidAmount)
    };
    
    // Trigger Notifications
    const io = req.app.get('io');
    
    // 1. Notify Admin about new booking
    NotificationService.notifyAdmins(io, {
      message: "New booking confirmed via checkout",
      type: "booking",
      metadata: { bookingId: result.id, farmerId }
    });
    
    // 2. Notify Admin about payment
    NotificationService.notifyAdmins(io, {
      message: `Initial payment received: ${formattedBooking.formattedPaidAmount}`,
      type: "payment",
      metadata: { bookingId: result.id, amount: result.paidAmount, farmerId }
    });

    return sendSuccess(res, formattedBooking, "Booking and payment confirmed successfully", 201);
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    return sendError(res, error.message, 500);
  }
};

/**
 * List all bookings for the logged-in farmer.
 */
export const listBookings = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { page, limit, status, search } = req.query;
    const data = await BookingService.getFarmerBookings(farmerId, { page, limit, status, search });
    return sendSuccess(res, data, "Farmer bookings retrieved");
  } catch (error) {
    return sendError(res, error.message);
  }
};

/**
 * Get details for a specific booking.
 */
export const getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user.id;
    const booking = await BookingService.getBookingById(id, farmerId);
    if (!booking) {
      return sendError(res, "Booking not found or access denied", 404, "NOT_FOUND");
    }
    return sendSuccess(res, booking, "Booking details retrieved");
  } catch (error) {
    return sendError(res, error.message);
  }
};

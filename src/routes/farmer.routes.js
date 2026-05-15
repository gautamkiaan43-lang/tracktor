import express from 'express';
import * as bookingController from '../controllers/farmer/booking.controller.js';
import * as serviceController from '../controllers/farmer/service.controller.js';
import * as dashboardController from '../controllers/farmer/dashboard.controller.js';
import * as profileController from '../controllers/farmer/profile.controller.js';
import { sendSuccess, sendError } from '../utils/response.js';
import * as settingsService from '../services/settings.service.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);

// --- Shared Public/Metadata Routes (Accessible by All Roles) ---

router.get('/services', requireRole(['farmer', 'operator', 'admin']), serviceController.listServices);

router.get('/settings/config', requireRole(['farmer', 'operator', 'admin']), async (req, res) => {
  try {
    const config = await settingsService.getSystemConfig();
    return sendSuccess(res, config, "Configuration retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
});

router.get('/zones', requireRole(['farmer', 'operator', 'admin']), async (req, res) => {
  try {
    const zones = await settingsService.listZones();
    return sendSuccess(res, zones, "Zones retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
});

// --- Private Farmer Routes (Restricted to Farmer Role Only) ---

router.use(requireRole(['farmer']));

// Dashboard routes
router.get('/dashboard', dashboardController.getDashboard);
router.get('/recent-activity', dashboardController.getRecentActivity);
router.get('/upcoming-jobs', dashboardController.getUpcomingJobs);

// Booking routes
router.post('/price-preview', bookingController.getPricePreview);
router.post('/bookings', bookingController.createBooking);
router.post('/checkout', bookingController.checkout);
router.get('/bookings', bookingController.listBookings);
router.get('/bookings/:id', bookingController.getBooking);

// Profile routes
router.get('/profile', profileController.getProfile);
router.patch('/profile', profileController.updateProfile);
router.patch('/change-password', profileController.changePassword);
router.patch('/language', profileController.updateLanguage);

export default router;


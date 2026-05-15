import express from 'express';
import * as assignmentController from '../controllers/admin/assignment.controller.js';
import * as adminController from '../controllers/admin/admin.controller.js';
import * as dashboardController from '../controllers/admin/dashboard.controller.js';
import * as reportController from '../controllers/admin/report.controller.js';
import * as settingsController from '../controllers/admin/settings.controller.js';
import * as fuelController from '../controllers/admin/fuel.controller.js';
import * as ussdLocationController from '../controllers/admin/ussdLocation.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['admin']));

// Dashboard APIs
router.get('/dashboard/metrics', dashboardController.getMetrics);
router.get('/dashboard/assignment-queue', dashboardController.getAssignmentQueue);
router.get('/dashboard/revenue', dashboardController.getRevenue);
router.get('/dashboard/fleet', dashboardController.getFleet);
router.get('/dashboard/active-jobs', dashboardController.getActiveJobs);

// Finance & Bookings
router.get('/bookings', adminController.getBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.get('/payments', adminController.getPayments);
router.post('/settle-booking/:bookingId', adminController.settleBooking);
// removed dummy sim route
router.put('/bookings/:id/fix-location', adminController.fixUSSDBooking);
router.post('/payments/record-cash', adminController.recordCashPayment);

// Assignment feature
router.get('/pending-assignment', assignmentController.getPendingBookings);
router.put('/schedule/:bookingId', assignmentController.scheduleBooking);
router.get('/operators', assignmentController.getAvailableOperators);
router.put('/assign/:bookingId', assignmentController.assignBooking);

// Farmers Management
router.get('/farmers', adminController.getFarmers);
router.put('/farmers/:id/status', adminController.updateFarmerStatus);

// Operator Management
router.get('/operator-list', adminController.getOperators); // renamed to avoid conflict with dispatch
router.post('/operators', adminController.createOperator);
router.delete('/operators/:id', adminController.deleteOperator);

/**
 * Tractor Management
 */
router.get('/tractors', adminController.getTractors);
router.post('/tractors', adminController.createTractor);
router.put('/tractors/:id', adminController.updateTractor);

// Fuel Logs Management
router.get('/fuel-logs', fuelController.getFuelLogs);
router.get('/fuel-logs/kpi', fuelController.getFuelLogsKPI);
router.get('/fuel-analytics', fuelController.getFuelAnalytics);
router.put('/fuel-logs/:id/status', fuelController.updateFuelLogStatus);

// Reports & Analytics
router.get('/reports/revenue', reportController.getRevenue);
router.get('/reports/service-usage', reportController.getServiceUsage);
router.get('/reports/fleet', reportController.getFleet);
router.get('/reports/farmers', reportController.getFarmers);
router.get('/reports/bookings-analytics', reportController.getBookingsAnalytics);
router.get('/reports/operator-performance', reportController.getOperatorPerformance);
router.get('/reports/job-status', reportController.getJobStatusDistribution);
router.get('/reports/tractor-profitability', reportController.getTractorProfitability);
router.get('/reports/export', reportController.getExportData);

// System Settings - Global Configuration
router.get('/settings/config', settingsController.getSystemConfig);
router.post('/settings/config', settingsController.updateSystemConfig);
router.get('/settings/fuel-history', settingsController.getFuelPriceLogs);

// System Settings - Distance Zones
router.get('/settings/zones', settingsController.listZones);
router.post('/settings/zones', settingsController.createZone);
router.put('/settings/zones/:id', settingsController.updateZone);
router.delete('/settings/zones/:id', settingsController.deleteZone);

// System Settings - USSD Locations
router.get('/settings/ussd-locations', ussdLocationController.listAll);
router.post('/settings/ussd-locations', ussdLocationController.create);
router.put('/settings/ussd-locations/:id', ussdLocationController.update);
router.delete('/settings/ussd-locations/:id', ussdLocationController.remove);

// System Settings - Services
router.get('/services', settingsController.listServices);
router.put('/services', settingsController.updateServiceRates);
router.put('/services/:id', settingsController.updateService);
router.delete('/services/:id', settingsController.deleteService);

export default router;


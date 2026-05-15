import express from 'express';
import * as paymentController from '../controllers/farmer/payment.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['farmer']));

// Payment management routes
router.get('/pending', paymentController.getPendingBookings);
router.get('/history', paymentController.getPaymentHistory);
router.post('/pay-booking', paymentController.payBooking);
router.post('/settle-all', paymentController.settleAll);

export default router;

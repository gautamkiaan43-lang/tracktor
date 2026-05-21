import express from 'express';
import * as loanController from '../controllers/farmer/loan.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['farmer']));

// Loan management routes
router.post('/apply', loanController.applyLoan);
router.get('/history', loanController.getLoanHistory);

export default router;

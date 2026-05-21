import * as LoanService from '../../services/loan.service.js';
import NotificationService from '../../services/notification.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Handle new loan application from farmer.
 */
export const applyLoan = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { bookingId, bvn, emiMonths } = req.body;

    if (!bookingId || !bvn || !emiMonths) {
      return sendError(res, "bookingId, bvn, and emiMonths are required parameters.", 400, "VALIDATION_ERROR");
    }

    const loan = await LoanService.applyForLoan(farmerId, { bookingId, bvn, emiMonths });

    // Format output for UI friendliness
    const formattedLoan = {
      ...loan,
      formattedAmount: formatCurrency(loan.amount),
      formattedEmiAmount: formatCurrency(loan.emiAmount)
    };

    // Trigger Admin & Farmer Notifications (non-blocking)
    try {
      const io = req.app.get('io');

      // 1. Notify Farmer
      NotificationService.notifyUser(io, farmerId, 'farmer', {
        message: `Your Soft Loan of ${formattedLoan.formattedAmount} has been approved!`,
        type: "payment",
        metadata: { bookingId: loan.bookingId, loanId: loan.id, amount: loan.amount }
      });

      // 2. Notify Admin
      NotificationService.notifyAdmins(io, {
        message: `New Soft Loan approved: ${formattedLoan.formattedAmount} (Farmer ID: ${farmerId})`,
        type: "payment",
        metadata: { bookingId: loan.bookingId, loanId: loan.id, amount: loan.amount, farmerId }
      });
    } catch (notifyError) {
      console.error('[LoanController] Notification error:', notifyError);
    }

    return sendSuccess(res, formattedLoan, "Soft Loan application approved successfully", 201);
  } catch (error) {
    const statusCode = error.message.includes('NOT_FOUND') ? 404 :
                      error.message.includes('FORBIDDEN') ? 403 :
                      error.message.includes('LOAN_DISABLED') ? 400 : 400;
    
    // Clean up error message prefix (e.g. "VALIDATION_ERROR: ...")
    const cleanMessage = error.message.replace(/^[A-Z_]+:\s*/, '');
    return sendError(res, cleanMessage, statusCode);
  }
};

/**
 * Get loan history for the logged-in farmer.
 */
export const getLoanHistory = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const loans = await LoanService.getFarmerLoans(farmerId);
    
    const formattedLoans = loans.map(loan => ({
      ...loan,
      formattedAmount: formatCurrency(loan.amount),
      formattedEmiAmount: formatCurrency(loan.emiAmount)
    }));

    return sendSuccess(res, formattedLoans, "Farmer loan history retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

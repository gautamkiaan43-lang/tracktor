import prisma from '../config/db.js';

/**
 * Get all loans for a farmer.
 */
export const getFarmerLoans = async (farmerId) => {
  console.log(`[LoanService] Fetching loan history for farmerId: ${farmerId}`);
  return await prisma.loan.findMany({
    where: { farmerId: parseInt(farmerId) },
    include: {
      booking: {
        include: {
          service: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Apply for a soft agricultural loan.
 */
export const applyForLoan = async (farmerId, { bookingId, bvn, emiMonths }) => {
  console.log(`[LoanService] Applying for loan: Farmer ${farmerId} | Booking ${bookingId} | BVN ${bvn} | EMIs ${emiMonths}`);

  // 1. Fetch System Settings to verify business rules
  let loanFeatureEnabled = false;
  let loanMaxAmount = 100000;
  let loanMinBookingValue = 50000;
  
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (config) {
    loanFeatureEnabled = config.loanFeatureEnabled;
    loanMaxAmount = config.loanMaxAmount;
    loanMinBookingValue = config.loanMinBookingValue;
  }

  // Verify feature switch
  if (!loanFeatureEnabled) {
    throw new Error('LOAN_DISABLED: Soft Loan facility is currently disabled by Administration.');
  }

  // 2. Fetch the target Booking
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) },
    include: { payments: true }
  });

  if (!booking) {
    throw new Error('NOT_FOUND: Booking not found.');
  }

  if (booking.farmerId !== parseInt(farmerId)) {
    throw new Error('FORBIDDEN: You do not have permission to access this booking.');
  }

  if (booking.paymentStatus === 'PAID') {
    throw new Error('VALIDATION_ERROR: Booking is already fully paid.');
  }

  // Check if booking value meets min/max constraints
  if (booking.finalPrice < loanMinBookingValue) {
    throw new Error(`VALIDATION_ERROR: Booking amount ₦${booking.finalPrice.toLocaleString()} is below the minimum required booking amount of ₦${loanMinBookingValue.toLocaleString()} to qualify for a Soft Loan.`);
  }

  if (booking.finalPrice > loanMaxAmount) {
    throw new Error(`VALIDATION_ERROR: Booking amount ₦${booking.finalPrice.toLocaleString()} exceeds the maximum Soft Loan limit of ₦${loanMaxAmount.toLocaleString()}.`);
  }

  // 3. Validate BVN format (must be 11 digits)
  const bvnRegex = /^\d{11}$/;
  if (!bvnRegex.test(bvn)) {
    throw new Error('VALIDATION_ERROR: Invalid Bank Verification Number (BVN). It must be exactly 11 digits.');
  }

  // 4. Calculate loan and EMIs
  // 5% flat agricultural interest rate (common for soft crop loans)
  const amountToFinance = booking.finalPrice - booking.payments.reduce((sum, p) => sum + p.amount, 0);
  const interestMultiplier = 1.05; 
  const totalPayable = amountToFinance * interestMultiplier;
  const emiAmount = parseFloat((totalPayable / parseInt(emiMonths)).toFixed(2));

  // 5. Execute atomic transaction
  return await prisma.$transaction(async (tx) => {
    const providerMode = process.env.LOAN_PROVIDER_MODE || 'MOCK';

    // A. Create the Loan Record
    const loan = await tx.loan.create({
      data: {
        bookingId: booking.id,
        farmerId: parseInt(farmerId),
        amount: parseFloat(amountToFinance.toFixed(2)),
        provider: providerMode,
        status: 'APPROVED', // Automatic mock approval
        bvnSnapshot: bvn.replace(/.(?=.{4})/g, '*'), // Mask BVN for security
        emiMonths: parseInt(emiMonths),
        emiAmount: emiAmount
      }
    });

    // B. Create the Payment Record matching the financed amount
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: parseFloat(amountToFinance.toFixed(2)),
        method: 'loan',
        status: 'full'
      }
    });

    // C. Transition Booking Payment Status to PAID
    await tx.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'PAID' }
    });

    return loan;
  });
};

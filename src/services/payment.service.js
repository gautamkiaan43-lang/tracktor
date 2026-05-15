import prisma from '../config/db.js';

/**
 * Get pending bookings for a farmer.
 * Includes calculated remaining amount and status aggregations.
 */
export const getFarmerPendingBookings = async (farmerId) => {
  console.log(`[PaymentService] Fetching pending bookings for farmerId: ${farmerId}`);
  
  const bookings = await prisma.booking.findMany({
    where: {
      farmerId: parseInt(farmerId),
      paymentStatus: { not: 'PAID' } // All bookings except already paid ones
    },
    include: {
      service: { select: { name: true } },
      payments: { select: { amount: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`[PaymentService] Found ${bookings.length} unpaid bookings.`);

  const results = bookings.map(booking => {
    const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = booking.finalPrice - totalPaid;
    
    console.log(`[PaymentService] Booking ID: ${booking.id} | Total: ${booking.finalPrice} | Paid: ${totalPaid} | Remaining: ${remainingAmount}`);

    // Map DB status 'PAID', 'PARTIAL', 'PENDING' to frontend expected 'full', 'partial', 'pending'
    let paymentStatus = 'pending';
    if (booking.paymentStatus === 'PAID') paymentStatus = 'full';
    else if (booking.paymentStatus === 'PARTIAL') paymentStatus = 'partial';
    
    // Fallback recalculation if it's somehow out of sync
    if (totalPaid > 0 && remainingAmount <= 0) paymentStatus = 'full';

    return {
      id: booking.id,
      serviceType: booking.service.name,
      totalAmount: booking.finalPrice,
      paidAmount: totalPaid,
      remainingAmount: Math.max(0, remainingAmount),
      paymentStatus,
      status: booking.status,
      createdAt: booking.createdAt
    };
  });

  const totalOutstanding = results.reduce((sum, b) => sum + b.remainingAmount, 0);
  console.log(`[PaymentService] Total Outstanding for Farmer ${farmerId}: ${totalOutstanding}`);

  return {
    bookings: results,
    totalOutstanding
  };
};

/**
 * Process payment for a specific booking.
 */
export const processBookingPayment = async (farmerId, { bookingId, amount, method }) => {
  console.log(`[PaymentService] Processing payment for booking ${bookingId} | Amount: ${amount}`);

  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(bookingId) },
    include: { payments: { select: { amount: true } } }
  });

  if (!booking) throw new Error('NOT_FOUND: Booking not found');
  if (booking.farmerId !== parseInt(farmerId)) throw new Error('FORBIDDEN: Access denied');

  const paidAmount = booking.payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = booking.finalPrice - paidAmount;

  console.log(`[PaymentService] Current Paid: ${paidAmount} | Total: ${booking.finalPrice} | New Payment: ${amount}`);

  if (amount > remainingAmount && remainingAmount > 0) {
    throw new Error(`VALIDATION_ERROR: Amount exceeds remaining balance of ${remainingAmount}`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Create a NEW payment record
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: parseFloat(amount),
        method: method || 'online' // Default to online
      }
    });

    // 2. Recalculate total paid to determine status
    const newPaidAmount = paidAmount + amount;
    let newPaymentStatus = booking.paymentStatus;
    
    if (newPaidAmount >= booking.finalPrice) {
      newPaymentStatus = 'PAID';
    } else if (newPaidAmount >= (booking.finalPrice * 0.5)) {
      newPaymentStatus = 'PARTIAL';
    }

    if (newPaymentStatus !== booking.paymentStatus) {
      console.log(`[PaymentService] Updating booking ${booking.id} paymentStatus to ${newPaymentStatus}`);
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: newPaymentStatus }
      });
    }

    return payment;
  });
};

/**
 * Settle all outstanding dues for a farmer.
 * (Disabled for manual cash settlement)
 */
export const settleAllDues = async (farmerId) => {
  throw new Error('Manual cash settlement is disabled. Payments must be processed individually via digital gateway.');
};

/**
 * Get payment history for a farmer.
 */
export const getFarmerPaymentHistory = async (farmerId) => {
  console.log(`[PaymentService] Fetching payment history for farmerId: ${farmerId}`);
  
  return await prisma.payment.findMany({
    where: {
      booking: {
        farmerId: parseInt(farmerId)
      }
    },
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

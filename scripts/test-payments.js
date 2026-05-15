import * as PaymentService from '../src/services/payment.service.js';
import prisma from '../src/config/db.js';

async function testPayments() {
  console.log('--- Starting Payment System Test ---');
  
  try {
    // 1. Find a farmer
    const farmer = await prisma.user.findFirst({ where: { role: 'farmer' } });
    if (!farmer) {
      console.error('No farmer found in DB. Please seed the database first.');
      return;
    }
    console.log(`Testing for Farmer: ${farmer.name} (ID: ${farmer.id})`);

    // 2. Get pending bookings
    const pending = await PaymentService.getFarmerPendingBookings(farmer.id);
    console.log(`Pending Bookings found: ${pending.length}`);
    
    if (pending.length === 0) {
      console.log('No pending bookings to test. Create some bookings first!');
      return;
    }

    const testBooking = pending[0];
    console.log(`Testing Individual Payment for Booking ID: ${testBooking.id}`);
    console.log(`Total: ${testBooking.totalAmount}, Remaining: ${testBooking.remainingAmount}`);

    // 3. Pay a portion (shoud result in 'partial' or 'paid' if amount matches)
    const payAmount = Math.min(testBooking.remainingAmount, 500); 
    if (payAmount > 0) {
      const payment = await PaymentService.processBookingPayment(farmer.id, {
        bookingId: testBooking.id,
        amount: payAmount,
        method: 'cash'
      });
      console.log(`Payment processed: ID ${payment.id}, Amount ${payment.amount}`);
      
      const updated = await PaymentService.getFarmerPendingBookings(farmer.id);
      const updatedBooking = updated.find(b => b.id === testBooking.id) || { paymentStatus: 'paid', remainingAmount: 0 };
      console.log(`New Status: ${updatedBooking.paymentStatus}, New Remaining: ${updatedBooking.remainingAmount}`);
    }

    // 4. Test Bulk Settlement
    console.log('\nTesting Bulk Settlement...');
    const bulkResult = await PaymentService.settleAllDues(farmer.id);
    console.log(bulkResult.message);
    if (bulkResult.totalPaid) console.log(`Total Settled: ${bulkResult.totalPaid}`);

    // 5. Final check
    const postBulk = await PaymentService.getFarmerPendingBookings(farmer.id);
    const stillPending = postBulk.filter(b => b.remainingAmount > 0);
    console.log(`Pending bookings remaining after bulk: ${stillPending.length}`);

  } catch (error) {
    console.error('Test Failed:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('--- Test Completed ---');
  }
}

testPayments();


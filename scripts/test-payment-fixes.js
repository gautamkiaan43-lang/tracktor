import * as PaymentService from '../src/services/payment.service.js';
import prisma from '../src/config/db.js';

async function testPaymentFixes() {
  console.log('--- Starting Payment System Fixes Test ---');
  
  try {
    const farmer = await prisma.user.findFirst({ where: { role: 'farmer' } });
    if (!farmer) return console.error('No farmer found.');

    console.log(`\n1. Testing Pending Bookings & Outstanding for Farmer: ${farmer.id}`);
    const pendingResult = await PaymentService.getFarmerPendingBookings(farmer.id);
    console.log(`Total Outstanding: ${pendingResult.totalOutstanding}`);
    console.log(`Unpaid Bookings Count: ${pendingResult.bookings.length}`);

    if (pendingResult.bookings.length > 0) {
      const b = pendingResult.bookings[0];
      console.log(`Testing Payment for ${b.id} | Remaining: ${b.remainingAmount}`);
      
      const p = await PaymentService.processBookingPayment(farmer.id, {
        bookingId: b.id,
        amount: 10,
        method: 'test-fix'
      });
      console.log(`Created payment ID: ${p.id}`);
    }

    console.log('\n2. Testing Payment History...');
    const history = await PaymentService.getFarmerPaymentHistory(farmer.id);
    console.log(`History records found: ${history.length}`);
    if (history.length > 0) {
      console.log(`Last payment: ${history[0].amount} for Booking ${history[0].bookingId} (${history[0].booking.service.name})`);
    }

    console.log('\n3. Testing Bulk Settlement...');
    const bulk = await PaymentService.settleAllDues(farmer.id);
    console.log(bulk.message);

    const final = await PaymentService.getFarmerPendingBookings(farmer.id);
    console.log(`Final Outstanding: ${final.totalOutstanding}`);

  } catch (error) {
    console.error('Test Failed:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n--- Test Completed ---');
  }
}

testPaymentFixes();


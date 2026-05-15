import * as AdminService from '../src/services/admin.service.js';
import prisma from '../src/config/db.js';

async function testAdminFix() {
  console.log('--- Starting Admin Dashboard Fix Test ---');
  
  try {
    // 1. Test All Bookings
    console.log('\n1. Testing All Bookings Retrieval...');
    const bookings = await AdminService.getAllBookings();
    console.log(`Total Bookings Fetched: ${bookings.length}`);
    if (bookings.length > 0) {
      const b = bookings[0];
      console.log(`Sample: Booking #${b.id} | Status: ${b.status} | Farmer: ${b.farmer?.name}`);
    }

    // 2. Test All Payments & Revenue
    console.log('\n2. Testing Payments & Revenue...');
    const paymentData = await AdminService.getAllPayments();
    console.log(`Total Payments Fetched: ${paymentData.payments.length}`);
    console.log(`Calculated Total Revenue: ₦${paymentData.totalRevenue.toLocaleString()}`);
    
    if (paymentData.payments.length > 0) {
      const p = paymentData.payments[0];
      console.log(`Sample: Payment ID ${p.id} | Amount: ${p.amount} | Booking ID: ${p.bookingId}`);
    }

    // 3. Verify Dispatch Route (Pending)
    console.log('\n3. Verifying Dispatch (Pending Only)...');
    const pending = await AdminService.getPendingBookings();
    const allScheduled = pending.every(b => b.status === 'scheduled');
    console.log(`Pending Bookings: ${pending.length} | All scheduled? ${allScheduled}`);

  } catch (error) {
    console.error('Test Failed:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n--- Admin Test Completed ---');
  }
}

testAdminFix();


import { getOperatorJobs, updateJobStatus } from '../src/services/operator.service.js';
import { assignOperator } from '../src/services/admin.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testStatusFlow() {
  try {
    console.log("=== Testing Operator Status Flow ===");

    // 1. Get an unassigned booking and demo operator
    const booking = await prisma.booking.findFirst({ where: { status: 'scheduled' } });
    const operator = await prisma.user.findFirst({ where: { email: 'operator@tractorlink.com' } });

    if (!booking || !operator) {
      console.log("Need a scheduled booking and operator to test.");
      return;
    }

    console.log(`\n1. Admin Assigns Booking ${booking.id} to Operator ${operator.id}`);
    await assignOperator(booking.id, operator.id);
    
    // Validate locking
    let chkOp = await prisma.user.findUnique({ where: { id: operator.id }});
    console.log(` -> Operator status: ${chkOp.status} (Expected: busy)`);

    console.log("\n2. Operator fetches their jobs");
    const jobs = await getOperatorJobs(operator.id);
    console.log(` -> Found ${jobs.length} job(s) for operator`);

    console.log("\n3. Testing INVALID transition (dispatched -> completed)");
    try {
      await updateJobStatus(operator.id, booking.id, 'completed');
    } catch (e) {
      console.log(` -> Expected Error caught: ${e.message}`);
    }

    console.log("\n4. Testing VALID transitions");
    console.log(` -> Updating to 'en_route'`);
    await updateJobStatus(operator.id, booking.id, 'en_route');
    
    console.log(` -> Updating to 'in_progress'`);
    await updateJobStatus(operator.id, booking.id, 'in_progress');
    
    console.log(` -> Updating to 'completed'`);
    await updateJobStatus(operator.id, booking.id, 'completed');

    // Validate unlocking
    chkOp = await prisma.user.findUnique({ where: { id: operator.id }});
    const chkTrac = await prisma.tractor.findFirst({ where: { operatorId: operator.id }});
    
    console.log(`\n5. Resource check after completion:`);
    console.log(` -> Operator status: ${chkOp.status} (Expected: available)`);
    console.log(` -> Tractor status: ${chkTrac.status} (Expected: available)`);

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testStatusFlow();


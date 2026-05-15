import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Resetting Demo Data...");

  // Reset booking 1 (from test script)
  await prisma.booking.updateMany({
    where: { id: 1 },
    data: { status: 'scheduled', operatorId: null, tractorId: null }
  });

  // Reset tractor
  await prisma.tractor.updateMany({
    where: { plateNumber: 'TL-DEMO-01' },
    data: { status: 'available' }
  });

  // Reset operator
  await prisma.user.updateMany({
    where: { email: 'operator@tractorlink.com' },
    data: { status: 'active' }
  });

  console.log("Demo reset complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


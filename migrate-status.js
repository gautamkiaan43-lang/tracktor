import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Starting Status Migration ---');

  // 1. Migrate Bookings
  const bookings = await prisma.booking.findMany();
  console.log(`Found ${bookings.length} bookings.`);
  
  for (const booking of bookings) {
    const oldStatus = booking.status;
    const newStatus = oldStatus.toUpperCase();
    
    if (oldStatus !== newStatus) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: newStatus }
      });
      console.log(`Updated Booking #${booking.id}: ${oldStatus} -> ${newStatus}`);
    }
  }

  // 2. Migrate Tractors
  const tractors = await prisma.tractor.findMany();
  console.log(`Found ${tractors.length} tractors.`);
  
  for (const tractor of tractors) {
    const oldStatus = tractor.status;
    const newStatus = oldStatus.toUpperCase();
    
    if (oldStatus !== newStatus) {
      await prisma.tractor.update({
        where: { id: tractor.id },
        data: { status: newStatus }
      });
      console.log(`Updated Tractor #${tractor.id}: ${oldStatus} -> ${newStatus}`);
    }
  }

  console.log('--- Migration Completed ---');
}

migrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

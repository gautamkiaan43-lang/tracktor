import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function deleteSatyam() {
  const email = 'satyam@123.com';
  
  console.log(`--- Deleting User: ${email} and related records ---`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { bookings: true }
    });

    if (!user) {
      console.log("User not found.");
      return;
    }

    const bookingIds = user.bookings.map(b => b.id);
    
    // 1. Delete Payments
    if (bookingIds.length > 0) {
      const pCount = await prisma.payment.deleteMany({
        where: { bookingId: { in: bookingIds } }
      });
      console.log(`Deleted ${pCount.count} payment(s).`);
    }

    // 2. Delete Bookings
    const bCount = await prisma.booking.deleteMany({
      where: { farmerId: user.id }
    });
    console.log(`Deleted ${bCount.count} booking(s).`);

    // 3. Delete User
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log(`Deleted User: ${user.name} (ID: ${user.id})`);

    console.log("--- Deletion Successful ---");
  } catch (error) {
    console.error("Deletion Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteSatyam();

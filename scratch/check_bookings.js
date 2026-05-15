import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'virlndra', mode: 'insensitive' } }
  });
  
  if (!user) {
    console.log("User not found");
    process.exit(0);
  }
  
  console.log("User ID:", user.id);
  
  const bookings = await prisma.booking.findMany({
    where: { farmerId: user.id },
    include: { operator: true, service: true },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log("Bookings:", JSON.stringify(bookings, null, 2));
  process.exit(0);
}

check();

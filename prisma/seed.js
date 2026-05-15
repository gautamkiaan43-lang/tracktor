import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const services = [
    { name: 'ploughing', description: 'Primary tillage to break up and turn over soil', baseRatePerHectare: 900 },
    { name: 'harrowing', description: 'Secondary tillage to break soil clods and level the field', baseRatePerHectare: 800 },
    { name: 'ridging', description: 'Create ridges for planting crops like yam and cassava', baseRatePerHectare: 700 },
    { name: 'planting', description: 'Mechanized seed planting for efficient coverage', baseRatePerHectare: 1000 },
    { name: 'harvesting', description: 'Mechanized harvesting for various crops', baseRatePerHectare: 2000 },
  ];

  console.log('Seeding services...');

  // Try to clean up old services (might fail if foreign keys exist, which is fine, we just want to remove unused ones)
  try {
    await prisma.service.deleteMany({
      where: {
        name: { notIn: services.map(s => s.name) }
      }
    });
  } catch (e) {
    console.log('Could not cleanly delete old services due to existing booking references. They will remain in DB but frontend logic relies on exact matches.');
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: { 
        baseRatePerHectare: service.baseRatePerHectare,
        description: service.description
      },
      create: service,
    });
  }

  console.log('Seeding demo users...');
  
  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashFarmer = await bcrypt.hash('farmer123', 10);
  const passwordHashOperator = await bcrypt.hash('operator123', 10);

  const demoUsers = [
    { name: 'Admin Demo', email: 'admin@tractorlink.com', passwordHash: passwordHashAdmin, role: 'admin', phone: '08000000001' },
    { name: 'Farmer Demo', email: 'farmer@tractorlink.com', passwordHash: passwordHashFarmer, role: 'farmer', phone: '08000000002' },
    { name: 'Kiaan Operator', email: 'operator@tractorlink.com', passwordHash: passwordHashOperator, role: 'operator', phone: '08000000003' }
  ];

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: user,
      create: user,
    });
  }

  console.log('Seeding system config...');
  await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {
      dieselPrice: 850,
      avgMileage: 2.5,
      hubName: 'North-East Agri Hub',
      hubLocation: 'Borno State, Nigeria',
      baseLatitude: 11.8333,
      baseLongitude: 13.1500,
      perKmRate: 1500,
      pricingMode: 'ZONE'
    },
    create: {
      id: 1,
      dieselPrice: 850,
      avgMileage: 2.5,
      hubName: 'North-East Agri Hub',
      hubLocation: 'Borno State, Nigeria',
      baseLatitude: 11.8333,
      baseLongitude: 13.1500,
      perKmRate: 1500,
      pricingMode: 'ZONE'
    }
  });

  console.log('Seeding service zones...');
  const zones = [
    { minDistance: 0, maxDistance: 5, surchargePerHectare: 0, status: 'ACTIVE' },
    { minDistance: 5, maxDistance: 15, surchargePerHectare: 500, status: 'ACTIVE' },
    { minDistance: 15, maxDistance: 30, surchargePerHectare: 1200, status: 'ACTIVE' },
    { minDistance: 30, maxDistance: null, surchargePerHectare: 2500, status: 'ACTIVE' }
  ];

  for (const zone of zones) {
    await prisma.zone.create({ data: zone });
  }

  console.log('Seeding demo tractor...');
  const operatorUser = await prisma.user.findUnique({ where: { phone: '08000000003' } });
  if (operatorUser) {
    await prisma.tractor.upsert({
      where: { operatorId: operatorUser.id },
      update: { 
        name: 'Thunderbolt-01',
        model: 'John Deere 5050D',
        status: 'available' 
      },
      create: {
        name: 'Thunderbolt-01',
        model: 'John Deere 5050D',
        status: 'available',
        operatorId: operatorUser.id
      }
    });
  }

  console.log('Seeding demo bookings for farmer...');
  const farmerUser = await prisma.user.findUnique({ where: { phone: '08000000002' } });
  const ploughingService = await prisma.service.findUnique({ where: { name: 'ploughing' } });
  
  if (farmerUser && ploughingService) {
    // 1. Completed & Paid Booking
    const booking1 = await prisma.booking.create({
      data: {
        farmerId: farmerUser.id,
        serviceId: ploughingService.id,
        landSize: 10,
        location: 'Green Valley Farm, Borno',
        basePrice: 9000,
        distanceKm: 4.2,
        distanceCharge: 0,
        totalPrice: 9000,
        finalPrice: 9000,
        status: 'completed',
        paymentStatus: 'PAID',
        hubName: 'North-East Agri Hub',
        serviceNameSnapshot: 'Ploughing'
      }
    });

    await prisma.payment.create({
      data: {
        bookingId: booking1.id,
        amount: 9000,
        method: 'online',
        status: 'full',
        reference: 'DEMO-PAY-1'
      }
    });

    // 2. Scheduled & Partial Paid Booking
    const booking2 = await prisma.booking.create({
      data: {
        farmerId: farmerUser.id,
        serviceId: ploughingService.id,
        landSize: 5,
        location: 'West Ridge Estate',
        basePrice: 4500,
        distanceKm: 12.5,
        distanceCharge: 2500,
        totalPrice: 7000,
        finalPrice: 7000,
        status: 'scheduled',
        paymentStatus: 'PARTIAL',
        hubName: 'North-East Agri Hub',
        serviceNameSnapshot: 'Ploughing'
      }
    });

    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        amount: 3500,
        method: 'online',
        status: 'partial',
        reference: 'DEMO-PAY-2'
      }
    });

    // 3. Pending Booking
    await prisma.booking.create({
      data: {
        farmerId: farmerUser.id,
        serviceId: ploughingService.id,
        landSize: 20,
        location: 'Sandy Plains',
        basePrice: 18000,
        distanceKm: 8,
        distanceCharge: 1000,
        totalPrice: 19000,
        finalPrice: 19000,
        status: 'scheduled',
        paymentStatus: 'PENDING',
        hubName: 'North-East Agri Hub',
        serviceNameSnapshot: 'Ploughing'
      }
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

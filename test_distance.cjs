const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function test() {
  const baseLatitude = 22.7546;
  const baseLongitude = 75.8947;
  const farmerLat = 22.6988;
  const farmerLng = 75.8611;

  const airDistance = haversine(baseLatitude, baseLongitude, farmerLat, farmerLng);
  console.log("Air distance:", airDistance);
  const roadDistance = airDistance > 0 ? airDistance * 1.3 : 0;
  console.log("Road distance:", roadDistance);

  // find zone
  const allZones = await prisma.zone.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { minDistance: 'asc' }
  });

  const roundedDistance = Math.round(roadDistance);
  console.log("Rounded:", roundedDistance);

  const matchedZone = allZones.find(z => 
    roundedDistance >= z.minDistance && (z.maxDistance === null || roundedDistance <= z.maxDistance)
  );

  console.log("Matched zone:", matchedZone);
}

test().finally(() => prisma.$disconnect());

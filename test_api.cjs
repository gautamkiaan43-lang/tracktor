const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function test() {
  const user = await prisma.user.findFirst({ where: { role: 'farmer' } });
  if (!user) {
    console.log("No farmer found");
    return;
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  
  const payload = {
    "serviceType": "harvesting",
    "landSize": 2,
    "location": "Pinned Location (22.6988, 75.8611)",
    "farmerLatitude": 22.6988,
    "farmerLongitude": 75.8611
  };
  try {
    const res = await fetch("http://localhost:5000/api/farmer/price-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    console.log(res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }
}

test().finally(() => prisma.$disconnect());

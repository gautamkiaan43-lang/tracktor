const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const zones = await prisma.zone.findMany();
  console.log(zones);
}

main().finally(() => prisma.$disconnect());

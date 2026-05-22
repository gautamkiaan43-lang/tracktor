const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  console.log(config);
}

main().finally(() => prisma.$disconnect());

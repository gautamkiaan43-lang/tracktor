import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "mysql://root:@127.0.0.1:3306/"
      }
    }
  });

  try {
    console.log('Attempting to connect to MySQL server...');
    const result = await prisma.$queryRaw`SHOW DATABASES`;
    console.log('Connection successful. Databases:', result);
  } catch (error) {
    console.error('Connection failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();


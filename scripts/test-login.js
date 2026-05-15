import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({ where: { email: 'operator@tractorlink.com' } });
  console.log("User:", {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  });
  
  const isMatch = await bcrypt.compare('operator123', user.passwordHash);
  console.log("operator123 matches hash:", isMatch);
}

checkUser().finally(() => prisma.$disconnect());


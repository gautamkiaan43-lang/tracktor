import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

export const registerUser = async (userData) => {
  const { name, password, phone, role } = userData;
  const systemEmail = `${phone}@tractorlink.app`;

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    throw new Error('User with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: systemEmail,
      passwordHash,
      phone,
      role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  return user;
};

export const loginUser = async (phone, password) => {
  const user = await prisma.user.findUnique({ where: { phone } });

  // status is exclusively for authentication — must be 'active' to log in
  if (!user || user.status !== 'active') {
    throw new Error('Invalid credentials or inactive account');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
};

export const getUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(11, "Phone number must be at most 11 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['farmer', 'operator']).default('farmer'),
});

export const loginSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(11, "Phone number must be at most 11 digits"),
  password: z.string().min(6, "Password is required"),
});

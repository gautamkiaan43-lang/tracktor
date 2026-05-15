import { z } from 'zod';

export const addFarmerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  location: z.string().optional(),
});

export const updateFarmerStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: "Status must be either 'active' or 'inactive'" })
  })
});

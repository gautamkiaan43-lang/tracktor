import { z } from 'zod';

export const bookingCreateSchema = z.object({
  serviceType: z.enum(['ploughing', 'harrowing', 'ridging', 'planting', 'harvesting'], {
    errorMap: () => ({ message: "Service type must be one of: ploughing, harrowing, ridging, planting, harvesting" })
  }),
  landSize: z.number().positive("Land size must be a positive number"),
  location: z.string().min(3, "Location must be at least 3 characters long"),
  zoneId: z.number().int().positive().optional().nullable(),
  farmerLatitude: z.number().optional().nullable(),
  farmerLongitude: z.number().optional().nullable(),
  // Optional: payment intent selection at booking time.
  // 'full'    → create full Payment record immediately
  // 'partial' → create 50% advance Payment record
  // 'later'   → no Payment record (default, cash at hub)
  paymentOption: z.enum(['full', 'partial', 'later']).optional().default('later'),
  source: z.enum(['WEB', 'USSD']).optional().default('WEB'),
  locationFixed: z.boolean().optional().default(true)
});

// Price preview does not need paymentOption — keep it separate
export const pricePreviewSchema = z.object({
  serviceType: z.enum(['ploughing', 'harrowing', 'ridging', 'planting', 'harvesting'], {
    errorMap: () => ({ message: "Service type must be one of: ploughing, harrowing, ridging, planting, harvesting" })
  }),
  landSize: z.number().positive("Land size must be a positive number"),
  location: z.string().min(3, "Location must be at least 3 characters long"),
  zoneId: z.number().int().positive().optional().nullable(),
  farmerLatitude: z.number().optional().nullable(),
  farmerLongitude: z.number().optional().nullable()
});


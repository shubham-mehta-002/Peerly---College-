import { z } from 'zod';

export const completeOnboardingSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  bio: z.string().max(500).optional(),
  campus_id: z.string().uuid('campus_id must be a valid UUID'),
});

export type CompleteOnboardingBody = z.infer<typeof completeOnboardingSchema>;

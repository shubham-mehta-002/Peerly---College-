import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export interface ProfileResponse {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  campus_id: string | null;
  updated_at: string;
}

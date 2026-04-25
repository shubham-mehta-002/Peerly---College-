import { z } from 'zod';

export const SendMessageSchema = z.object({
  communityId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  image_url: z.string().url().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export interface MessageResponse {
  id: string;
  community_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender: { username: string; avatar_url: string | null };
  is_system?: boolean;
}

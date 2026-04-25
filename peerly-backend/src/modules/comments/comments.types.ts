import { z } from 'zod';

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(1000),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional(),
});

export type AddCommentBody = z.infer<typeof addCommentSchema>;

export interface CommentResponse {
  id: string;
  parent_id: string | null;
  depth: number;
  content: string;
  created_at: string;
  author: { username: string; avatar_url: string | null };
}

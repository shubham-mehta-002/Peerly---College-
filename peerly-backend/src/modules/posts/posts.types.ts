import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
  image_urls: z.array(z.string().url('Invalid image URL')).max(4, 'Maximum 4 images').default([]),
  is_global: z.boolean().default(false),
  is_anonymous: z.boolean().default(false),
});

export const feedQuerySchema = z.object({
  sort: z.enum(['latest', 'oldest', 'upvoted', 'trending']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const voteSchema = z.object({
  vote_type: z.enum(['up', 'down']).nullable(),
});

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type VoteBody = z.infer<typeof voteSchema>;

export interface DisplayAuthor {
  username: string;
  name: string | null;
  avatar_url: string | null;
}

export interface PostResponse {
  id: string;
  content: string;
  image_urls: string[];
  is_global: boolean;
  is_anonymous: boolean;
  upvotes: number;
  comment_count: number;
  heat_score: number;
  created_at: string;
  campus_id: string;
  display_author: DisplayAuthor;
  user_vote: 'up' | 'down' | null;
}

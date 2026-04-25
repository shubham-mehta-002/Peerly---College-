import { z } from 'zod';

export const CreateCommunitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['Technical', 'Cultural', 'Sports']),
  is_global: z.boolean().default(false),
});

export const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['Technical', 'Cultural', 'Sports']).optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export type CreateCommunityInput = z.infer<typeof CreateCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof UpdateCommunitySchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: CommunityRole | null;
}

export interface MemberResponse {
  user_id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  role: CommunityRole;
  joined_at: string;
}

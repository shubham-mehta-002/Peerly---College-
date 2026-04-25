import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { UpdateProfileInput, ProfileResponse } from './profile.types';

export async function getProfile(userId: string): Promise<ProfileResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, name, bio, avatar_url, campus_id, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');
  return data as ProfileResponse;
}

export async function getPublicProfile(username: string): Promise<ProfileResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, name, bio, avatar_url, campus_id, updated_at')
    .eq('username', username)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');
  return data as ProfileResponse;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, username, name, bio, avatar_url, campus_id, updated_at')
    .single();

  if (error) throw new AppError(500, 'Failed to update profile');
  if (!data) throw new AppError(404, 'Profile not found');
  return data as ProfileResponse;
}

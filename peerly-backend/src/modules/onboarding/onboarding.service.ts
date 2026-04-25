import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { extractDomain } from '../auth/auth.service';
import { CompleteOnboardingBody } from './onboarding.types';

export async function getCampusesForUser(email: string) {
  const domain = extractDomain(email);

  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('college_id')
    .eq('domain', domain)
    .eq('is_active', true)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');

  const { data: campuses, error } = await supabaseAdmin
    .from('campuses')
    .select('id, name, college_id')
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .order('name');

  if (error) {
    logger.error('Failed to fetch campuses for onboarding', {
      error: error.message,
      collegeId: domainRow.college_id,
    });
    throw new AppError(500, 'Failed to fetch campuses');
  }

  return campuses ?? [];
}

export async function completeOnboarding(
  userId: string,
  email: string,
  isAdmin: boolean,
  body: CompleteOnboardingBody
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single();

  if (profile?.onboarding_completed) {
    throw new AppError(400, 'Onboarding already completed');
  }

  const domain = extractDomain(email);

  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('college_id')
    .eq('domain', domain)
    .eq('is_active', true)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');

  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('id', body.campus_id)
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .single();

  if (!campus) throw new AppError(400, 'Invalid campus for your institution');

  const { data: existingUsername } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', body.username)
    .single();

  if (existingUsername) throw new AppError(409, 'Username already taken');

  const { data: updatedProfile, error } = await supabaseAdmin
    .from('profiles')
    .update({
      name: body.name.trim(),
      username: body.username.toLowerCase().trim(),
      bio: body.bio?.trim() ?? null,
      campus_id: body.campus_id,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error || !updatedProfile) {
    logger.error('Failed to complete onboarding', { userId, error: error?.message });
    throw new AppError(500, 'Failed to complete onboarding');
  }

  logger.info('Onboarding completed', { userId, campusId: body.campus_id });

  const token = signToken({ userId, email, isAdmin, campusId: body.campus_id });

  return { token, profile: updatedProfile };
}

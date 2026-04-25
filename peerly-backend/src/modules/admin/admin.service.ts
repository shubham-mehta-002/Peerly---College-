import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export async function createCollege(name: string) {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create college', { error: error?.message });
    throw new AppError(500, 'Failed to create college');
  }

  logger.info('College created', { collegeId: data.id, name: data.name });
  return data;
}

export async function listColleges() {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .select('*, college_domains(count), campuses(count)')
    .order('name');

  if (error) {
    logger.error('Failed to list colleges', { error: error.message });
    throw new AppError(500, 'Failed to fetch colleges');
  }

  return data ?? [];
}

export async function updateCollege(id: string, updates: { name?: string; is_active?: boolean }) {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'College not found');
  return data;
}

export async function createDomain(collegeId: string, domain: string) {
  const normalized = domain.toLowerCase().trim();

  const { data: existing } = await supabaseAdmin
    .from('college_domains')
    .select('id')
    .eq('domain', normalized)
    .single();

  if (existing) throw new AppError(409, 'Domain already registered');

  const { data, error } = await supabaseAdmin
    .from('college_domains')
    .insert({ college_id: collegeId, domain: normalized })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to add domain', { error: error?.message, collegeId });
    throw new AppError(500, 'Failed to add domain');
  }

  logger.info('Domain added', { domainId: data.id, domain: normalized, collegeId });
  return data;
}

export async function listDomains(collegeId: string) {
  const { data, error } = await supabaseAdmin
    .from('college_domains')
    .select('*')
    .eq('college_id', collegeId)
    .order('domain');

  if (error) {
    logger.error('Failed to list domains', { error: error.message, collegeId });
    throw new AppError(500, 'Failed to fetch domains');
  }

  return data ?? [];
}

export async function updateDomain(
  collegeId: string,
  domainId: string,
  updates: { is_active?: boolean; domain?: string }
) {
  const payload: Record<string, unknown> = {};
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
  if (updates.domain !== undefined) payload.domain = updates.domain.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('college_domains')
    .update(payload)
    .eq('id', domainId)
    .eq('college_id', collegeId)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'Domain not found');
  return data;
}

export async function createCampus(collegeId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .insert({ college_id: collegeId, name: name.trim() })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create campus', { error: error?.message, collegeId });
    throw new AppError(500, 'Failed to create campus');
  }

  logger.info('Campus created', { campusId: data.id, name: data.name, collegeId });
  return data;
}

export async function listCampuses(collegeId: string) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .select('*')
    .eq('college_id', collegeId)
    .order('name');

  if (error) {
    logger.error('Failed to list campuses', { error: error.message, collegeId });
    throw new AppError(500, 'Failed to fetch campuses');
  }

  return data ?? [];
}

export async function updateCampus(
  collegeId: string,
  campusId: string,
  updates: { name?: string; is_active?: boolean }
) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .update(updates)
    .eq('id', campusId)
    .eq('college_id', collegeId)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'Campus not found');
  return data;
}

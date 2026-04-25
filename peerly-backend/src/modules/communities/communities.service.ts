import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { getCommunityNs } from '../../lib/gateway-singleton';
import type {
  CreateCommunityInput,
  UpdateCommunityInput,
  UpdateMemberRoleInput,
  CommunityRole,
  CommunityResponse,
  MemberResponse,
} from './communities.types';

export const ROLE_RANK: Record<CommunityRole, number> = {
  owner: 4, admin: 3, moderator: 2, member: 1,
};

export async function getMemberRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const { data, error } = await supabaseAdmin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new AppError(500, 'Failed to fetch member role');
  return (data?.role as CommunityRole) ?? null;
}

function isAdmin(role: CommunityRole | null): boolean {
  return role === 'admin' || role === 'owner';
}

export async function getCommunities(campusId: string, userId: string, search?: string): Promise<CommunityResponse[]> {
  let query = supabaseAdmin
    .from('communities')
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .or(`campus_id.eq.${campusId},is_global.eq.true`)
    .order('member_count', { ascending: false });

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) throw new AppError(500, 'Failed to fetch communities');
  if (!data || data.length === 0) return [];

  const communityIds = data.map((c) => c.id);
  const { data: memberships } = await supabaseAdmin
    .from('community_members')
    .select('community_id, role')
    .eq('user_id', userId)
    .in('community_id', communityIds);

  const roleMap = new Map(memberships?.map((m) => [m.community_id, m.role as CommunityRole]));

  return data.map((c) => ({ ...c, user_role: roleMap.get(c.id) ?? null }));
}

export async function getCommunity(communityId: string, userId: string): Promise<CommunityResponse> {
  const { data, error } = await supabaseAdmin
    .from('communities')
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .eq('id', communityId)
    .single();

  if (error || !data) throw new AppError(404, 'Community not found');
  const role = await getMemberRole(communityId, userId);
  return { ...data, user_role: role } as CommunityResponse;
}

export async function createCommunity(input: CreateCommunityInput, userId: string, campusId: string): Promise<CommunityResponse> {
  const { data: community, error } = await supabaseAdmin
    .from('communities')
    .insert({ ...input, campus_id: campusId, created_by: userId, member_count: 1 })
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .single();

  if (error || !community) throw new AppError(500, 'Failed to create community');

  const { error: memberError } = await supabaseAdmin.from('community_members').insert({
    community_id: community.id,
    user_id: userId,
    role: 'admin',
  });
  if (memberError) throw new AppError(500, 'Failed to initialize community membership');

  return { ...community, user_role: 'admin' } as CommunityResponse;
}

export async function updateCommunity(communityId: string, input: UpdateCommunityInput, userId: string): Promise<CommunityResponse> {
  const role = await getMemberRole(communityId, userId);
  if (!isAdmin(role)) throw new AppError(403, 'Admins only');

  const { data, error } = await supabaseAdmin
    .from('communities')
    .update(input)
    .eq('id', communityId)
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .single();

  if (error || !data) throw new AppError(500, 'Failed to update community');
  return { ...data, user_role: role } as CommunityResponse;
}

export async function deleteCommunity(communityId: string, userId: string): Promise<void> {
  const role = await getMemberRole(communityId, userId);
  if (!isAdmin(role)) throw new AppError(403, 'Admins only');

  const { error } = await supabaseAdmin.from('communities').delete().eq('id', communityId);
  if (error) throw new AppError(500, 'Failed to delete community');
}

export async function joinCommunity(communityId: string, userId: string): Promise<void> {
  const { data: community, error: fetchErr } = await supabaseAdmin
    .from('communities')
    .select('member_count')
    .eq('id', communityId)
    .single();

  if (fetchErr || !community) throw new AppError(404, 'Community not found');
  if (community.member_count >= 200) throw new AppError(403, 'Community is full');

  const existing = await getMemberRole(communityId, userId);
  if (existing) throw new AppError(409, 'Already a member');

  await supabaseAdmin.from('community_members').insert({ community_id: communityId, user_id: userId, role: 'member' });
  await supabaseAdmin.from('communities').update({ member_count: community.member_count + 1 }).eq('id', communityId);
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const role = await getMemberRole(communityId, userId);
  if (!role) throw new AppError(404, 'Not a member');

  if (isAdmin(role)) {
    const { count } = await supabaseAdmin
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .in('role', ['admin', 'owner']);

    if ((count ?? 0) <= 1) {
      throw new AppError(400, 'You are the only admin. Assign another admin before leaving.');
    }
  }

  const [{ data: profile }, { data: community }] = await Promise.all([
    supabaseAdmin.from('profiles').select('username').eq('id', userId).single(),
    supabaseAdmin.from('communities').select('member_count').eq('id', communityId).single(),
  ]);

  await supabaseAdmin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId);

  await supabaseAdmin
    .from('communities')
    .update({ member_count: Math.max(0, (community?.member_count ?? 1) - 1) })
    .eq('id', communityId);

  const ns = getCommunityNs();
  if (ns && profile?.username) {
    ns.to(communityId).emit('new_message', {
      id: `sys_${Date.now()}`,
      community_id: communityId,
      content: `${profile.username} left the community`,
      image_url: null,
      created_at: new Date().toISOString(),
      sender: { username: profile.username, avatar_url: null },
      is_system: true,
    });
  }
}

export async function kickMember(communityId: string, kickerId: string, targetId: string): Promise<void> {
  const kickerRole = await getMemberRole(communityId, kickerId);
  const targetRole = await getMemberRole(communityId, targetId);

  if (!kickerRole || !targetRole) throw new AppError(404, 'Member not found');
  if (!isAdmin(kickerRole)) throw new AppError(403, 'Admins only');
  if (isAdmin(targetRole)) throw new AppError(403, 'Cannot kick an admin — demote them first');

  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('member_count')
    .eq('id', communityId)
    .single();

  const { error: kickError } = await supabaseAdmin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', targetId);
  if (kickError) throw new AppError(500, 'Failed to kick member');

  await supabaseAdmin
    .from('communities')
    .update({ member_count: Math.max(0, (community?.member_count ?? 1) - 1) })
    .eq('id', communityId);
}

export async function updateMemberRole(communityId: string, updaterId: string, targetId: string, input: UpdateMemberRoleInput): Promise<void> {
  if (updaterId === targetId) throw new AppError(400, 'Cannot change your own role');

  const updaterRole = await getMemberRole(communityId, updaterId);
  const targetRole = await getMemberRole(communityId, targetId);

  if (!updaterRole || !targetRole) throw new AppError(404, 'Member not found');
  if (!isAdmin(updaterRole)) throw new AppError(403, 'Admins only');

  await supabaseAdmin
    .from('community_members')
    .update({ role: input.role })
    .eq('community_id', communityId)
    .eq('user_id', targetId);
}

export async function getMembers(communityId: string, requesterId: string): Promise<MemberResponse[]> {
  const role = await getMemberRole(communityId, requesterId);
  if (!isAdmin(role)) throw new AppError(403, 'Admins only');

  const { data, error } = await supabaseAdmin
    .from('community_members')
    .select('role, joined_at, profiles!user_id(id, username, name, avatar_url)')
    .eq('community_id', communityId)
    .order('joined_at', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch members');

  return (data ?? []).map((m) => {
    const p = m.profiles as unknown as { id: string; username: string; name: string | null; avatar_url: string | null };
    return {
      user_id: p.id,
      username: p.username,
      name: p.name,
      avatar_url: p.avatar_url,
      role: m.role as CommunityRole,
      joined_at: m.joined_at as string,
    };
  });
}

export async function transferOwnership(communityId: string, currentOwnerId: string, newOwnerId: string): Promise<void> {
  const ownerRole = await getMemberRole(communityId, currentOwnerId);
  if (!isAdmin(ownerRole)) throw new AppError(403, 'Admins only');

  const targetRole = await getMemberRole(communityId, newOwnerId);
  if (!targetRole) throw new AppError(404, 'Target user is not a member');

  await supabaseAdmin
    .from('community_members')
    .update({ role: 'member' })
    .eq('community_id', communityId)
    .eq('user_id', currentOwnerId);

  await supabaseAdmin
    .from('community_members')
    .update({ role: 'admin' })
    .eq('community_id', communityId)
    .eq('user_id', newOwnerId);
}

import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { MessageResponse } from './messages.types';

const MESSAGE_SELECT = 'id, community_id, content, image_url, created_at, profiles!sender_id(username, avatar_url)';

function toResponse(row: Record<string, unknown>): MessageResponse {
  const profile = row.profiles as { username: string; avatar_url: string | null };
  return {
    id: row.id as string,
    community_id: row.community_id as string,
    content: row.content as string,
    image_url: row.image_url as string | null,
    created_at: row.created_at as string,
    sender: { username: profile.username, avatar_url: profile.avatar_url },
  };
}

export async function saveMessage(input: {
  communityId: string;
  senderId: string;
  content: string;
  image_url?: string;
}): Promise<MessageResponse> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      community_id: input.communityId,
      sender_id: input.senderId,
      content: input.content,
      image_url: input.image_url ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error || !data) throw new AppError(500, 'Failed to save message');
  return toResponse(data as Record<string, unknown>);
}

export async function getHistory(communityId: string, before?: string, limit = 50): Promise<MessageResponse[]> {
  const cap = Math.min(limit, 50);

  let cursorTime: string | null = null;
  if (before) {
    const { data: cursor } = await supabaseAdmin
      .from('messages')
      .select('created_at')
      .eq('id', before)
      .single();
    cursorTime = cursor?.created_at ?? null;
  }

  let query = supabaseAdmin
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false }); // newest-first so limit gives latest N

  if (cursorTime) query = query.lt('created_at', cursorTime);

  const { data, error } = await query.limit(cap);
  if (error) throw new AppError(500, 'Failed to fetch messages');

  // reverse so caller always receives oldest→newest
  return (data ?? []).map((row) => toResponse(row as Record<string, unknown>)).reverse();
}

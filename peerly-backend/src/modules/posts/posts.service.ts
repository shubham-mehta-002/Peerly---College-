import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { CreatePostBody, FeedQuery, PostResponse, DisplayAuthor } from './posts.types';

export function computeHeatScore(
  upvotes: number,
  downvotes: number,
  commentCount: number,
  createdAt: string
): number {
  const hoursSincePosted = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const raw = (upvotes * 2 + commentCount * 1.5 - downvotes) / Math.pow(hoursSincePosted + 2, 1.8);
  return Math.max(0, parseFloat(raw.toFixed(6)));
}

export function maskAuthor(
  authorId: string,
  isAnonymous: boolean,
  viewerUserId: string,
  feedType: 'campus' | 'global',
  collegeName: string,
  username: string,
  name: string | null,
  avatarUrl: string | null
): DisplayAuthor {
  if (!isAnonymous || authorId === viewerUserId) {
    return { username, name, avatar_url: avatarUrl };
  }
  return {
    username: feedType === 'global' ? `Anonymous @ ${collegeName}` : 'Anonymous Peer',
    name: null,
    avatar_url: null,
  };
}

export async function createPost(
  userId: string,
  campusId: string,
  body: CreatePostBody
): Promise<Omit<PostResponse, 'display_author' | 'user_vote'>> {
  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('college_id')
    .eq('id', campusId)
    .single();

  if (!campus) throw new AppError(400, 'Invalid campus');

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .insert({
      author_id: userId,
      campus_id: campusId,
      college_id: campus.college_id,
      content: body.content,
      image_urls: body.image_urls,
      is_global: body.is_global,
      is_anonymous: body.is_anonymous,
    })
    .select('id, content, image_urls, is_global, is_anonymous, upvotes, comment_count, heat_score, created_at, campus_id')
    .single();

  if (error || !post) {
    logger.error('Failed to create post', { error: error?.message, userId });
    throw new AppError(500, 'Failed to create post');
  }

  logger.info('Post created', { postId: post.id, userId, campusId });
  return post;
}

const POST_SELECT = `
  id, author_id, content, image_urls, is_global, is_anonymous,
  upvotes, downvotes, comment_count, heat_score, created_at, campus_id,
  author:profiles!author_id(username, name, avatar_url),
  college:colleges!college_id(name)
`;

function buildPostResponse(
  post: any,
  feedType: 'campus' | 'global',
  viewerUserId: string,
  userVote: 'up' | 'down' | null
): PostResponse {
  const author = post.author as { username: string; name: string | null; avatar_url: string | null } | null;
  const collegeName = (post.college as { name: string } | null)?.name ?? 'Unknown';
  const display_author = maskAuthor(
    post.author_id,
    post.is_anonymous,
    viewerUserId,
    feedType,
    collegeName,
    author?.username ?? 'Unknown',
    author?.name ?? null,
    author?.avatar_url ?? null
  );
  const { author_id: _aid, author: _a, college: _c, downvotes: _d, ...rest } = post;
  return { ...rest, display_author, user_vote: userVote };
}

export async function getFeed(
  options: FeedQuery & { feedType: 'campus' | 'global'; campusId: string; viewerUserId: string }
): Promise<PostResponse[]> {
  const { feedType, campusId, sort, page, limit, viewerUserId } = options;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin.from('posts').select(POST_SELECT);

  if (feedType === 'campus') {
    query = query.eq('campus_id', campusId) as any;
  } else {
    query = query.eq('is_global', true) as any;
  }

  switch (sort) {
    case 'oldest':   query = query.order('created_at', { ascending: true }) as any; break;
    case 'upvoted':  query = query.order('upvotes', { ascending: false }) as any; break;
    case 'trending': query = query.order('heat_score', { ascending: false }) as any; break;
    default:         query = query.order('created_at', { ascending: false }) as any; break;
  }

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to fetch feed', { error: error.message, feedType });
    throw new AppError(500, 'Failed to fetch feed');
  }
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const { data: votes } = await supabaseAdmin
    .from('post_votes')
    .select('post_id, vote_type')
    .eq('user_id', viewerUserId)
    .in('post_id', postIds);

  const voteMap = new Map(votes?.map((v: any) => [v.post_id, v.vote_type as 'up' | 'down']));

  return posts.map((p: any) =>
    buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null)
  );
}

export async function getPost(postId: string, viewerUserId: string): Promise<PostResponse> {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .single();

  if (error || !post) throw new AppError(404, 'Post not found');

  const { data: voteRow } = await supabaseAdmin
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', viewerUserId)
    .single();

  const feedType = post.is_global ? 'global' as const : 'campus' as const;
  return buildPostResponse(post, feedType, viewerUserId, voteRow?.vote_type as 'up' | 'down' | null ?? null);
}

export async function deletePost(postId: string, userId: string, isAdmin: boolean): Promise<void> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');
  if (post.author_id !== userId && !isAdmin) throw new AppError(403, 'Not authorized');

  await supabaseAdmin.from('posts').delete().eq('id', postId);
  logger.info('Post deleted', { postId, userId });
}

export async function castVote(
  postId: string,
  userId: string,
  voteType: 'up' | 'down' | null
): Promise<void> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');

  const { data: existing } = await supabaseAdmin
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  let { upvotes, downvotes } = post;

  if (voteType === null) {
    if (!existing) return;
    if (existing.vote_type === 'up') upvotes = Math.max(0, upvotes - 1);
    else downvotes = Math.max(0, downvotes - 1);
    await supabaseAdmin.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
  } else if (!existing) {
    if (voteType === 'up') upvotes++;
    else downvotes++;
    await supabaseAdmin.from('post_votes').insert({ post_id: postId, user_id: userId, vote_type: voteType });
  } else if (existing.vote_type === voteType) {
    return;
  } else {
    if (voteType === 'up') { upvotes++; downvotes = Math.max(0, downvotes - 1); }
    else { downvotes++; upvotes = Math.max(0, upvotes - 1); }
    await supabaseAdmin.from('post_votes').update({ vote_type: voteType }).eq('post_id', postId).eq('user_id', userId);
  }

  const heat_score = computeHeatScore(upvotes, downvotes, post.comment_count, post.created_at);
  await supabaseAdmin.from('posts').update({ upvotes, downvotes, heat_score }).eq('id', postId);
}

import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { computeHeatScore } from '../posts/posts.service';
import { AddCommentBody, CommentResponse } from './comments.types';

export async function addComment(
  postId: string,
  userId: string,
  body: AddCommentBody
): Promise<CommentResponse> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');

  let depth = 0;
  if (body.parent_id) {
    const { data: parent } = await supabaseAdmin
      .from('comments')
      .select('depth, post_id')
      .eq('id', body.parent_id)
      .single();

    if (!parent || parent.post_id !== postId) {
      throw new AppError(400, 'Invalid parent comment');
    }
    depth = parent.depth + 1;
  }

  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({
      post_id: postId,
      author_id: userId,
      parent_id: body.parent_id ?? null,
      content: body.content,
      depth,
    })
    .select(`id, parent_id, depth, content, created_at, author:profiles!author_id(username, avatar_url)`)
    .single();

  if (error || !comment) {
    logger.error('Failed to add comment', { error: error?.message, postId, userId });
    throw new AppError(500, 'Failed to add comment');
  }

  const newCount = post.comment_count + 1;
  const heat_score = computeHeatScore(post.upvotes, post.downvotes, newCount, post.created_at);
  await supabaseAdmin.from('posts').update({ comment_count: newCount, heat_score }).eq('id', postId);

  logger.info('Comment added', { commentId: comment.id, postId, userId });
  return comment as unknown as CommentResponse;
}

export async function getComments(postId: string): Promise<CommentResponse[]> {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select(`id, parent_id, depth, content, created_at, author:profiles!author_id(username, avatar_url)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch comments', { error: error.message, postId });
    throw new AppError(500, 'Failed to fetch comments');
  }

  return (data ?? []) as unknown as CommentResponse[];
}

export async function deleteComment(
  commentId: string,
  postId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('author_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.post_id !== postId) throw new AppError(404, 'Comment not found');
  if (comment.author_id !== userId && !isAdmin) throw new AppError(403, 'Not authorized');

  await supabaseAdmin.from('comments').delete().eq('id', commentId);

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (post) {
    const newCount = Math.max(0, post.comment_count - 1);
    const heat_score = computeHeatScore(post.upvotes, post.downvotes, newCount, post.created_at);
    await supabaseAdmin.from('posts').update({ comment_count: newCount, heat_score }).eq('id', postId);
  }

  logger.info('Comment deleted', { commentId, postId, userId });
}

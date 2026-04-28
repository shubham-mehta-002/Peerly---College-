import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { ReportReason, PostReportSummary, AdminReportsQuery } from './reports.types';

export async function createReport(
  postId: string,
  reporterId: string,
  reason: ReportReason,
  customText?: string
): Promise<void> {
  const { data: post, error: postErr } = await supabaseAdmin
    .from('posts')
    .select('id, report_count')
    .eq('id', postId)
    .single();

  if (postErr || !post) throw new AppError(404, 'Post not found');

  const { error: insertError } = await supabaseAdmin
    .from('post_reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason, custom_text: customText ?? null });

  if (insertError) {
    if (insertError.code === '23505') throw new AppError(409, 'You have already reported this post');
    throw new AppError(500, 'Failed to submit report');
  }

  await supabaseAdmin
    .from('posts')
    .update({ report_count: (post as { report_count: number }).report_count + 1 })
    .eq('id', postId);
}

export async function getAdminReports(options: AdminReportsQuery): Promise<PostReportSummary[]> {
  const { reason, page, limit } = options;
  const offset = (page - 1) * limit;

  let postIds: string[] | null = null;

  if (reason) {
    const { data: reported } = await supabaseAdmin
      .from('post_reports')
      .select('post_id')
      .eq('reason', reason);
    postIds = [...new Set((reported ?? []).map((r: { post_id: string }) => r.post_id))];
    if (postIds.length === 0) return [];
  }

  let query = supabaseAdmin
    .from('posts')
    .select('id, content, report_count, is_hidden, created_at, author:profiles!author_id(username, name, avatar_url)')
    .gt('report_count', 0)
    .order('report_count', { ascending: false });

  if (postIds) query = (query as any).in('id', postIds);

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);
  if (error) throw new AppError(500, 'Failed to fetch reports');
  if (!posts || posts.length === 0) return [];

  const ids = (posts as { id: string }[]).map(p => p.id);
  const { data: reasons } = await supabaseAdmin
    .from('post_reports')
    .select('post_id, reason')
    .in('post_id', ids);

  const breakdownMap = new Map<string, Record<string, number>>();
  for (const r of (reasons ?? []) as { post_id: string; reason: string }[]) {
    if (!breakdownMap.has(r.post_id)) breakdownMap.set(r.post_id, {});
    const bd = breakdownMap.get(r.post_id)!;
    bd[r.reason] = (bd[r.reason] ?? 0) + 1;
  }

  return (posts as any[]).map(p => {
    const author = p.author as { username: string; name: string | null; avatar_url: string | null } | null;
    return {
      id: p.id,
      content: p.content,
      author: { username: author?.username ?? 'Unknown', name: author?.name ?? null, avatar_url: author?.avatar_url ?? null },
      created_at: p.created_at,
      report_count: p.report_count,
      is_hidden: p.is_hidden,
      reason_breakdown: breakdownMap.get(p.id) ?? {},
    };
  });
}

export async function hidePost(postId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .update({ is_hidden: true })
    .eq('id', postId)
    .select('id')
    .single();

  if (error || !data) throw new AppError(404, 'Post not found');
}

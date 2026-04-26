'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { Avatar } from '@/components/ui/avatar';
import { AnonLabel } from '@/components/ui/anon-label';
import { Btn } from '@/components/ui/btn';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { usePost, usePostVote, type PostResponse } from '@/lib/hooks/useFeed';
import { useComments, useAddComment, type CommentResponse } from '@/lib/hooks/useComments';
import { PostDetailSkeleton, CommentsSkeleton } from '@/components/skeletons';
import { formatRelativeTime } from '@/lib/time';

const ANON_PREFIXES = ['Anonymous Peer', 'Anonymous @'];
function isAnon(username: string) { return ANON_PREFIXES.some(p => username.startsWith(p)); }

function buildTree(comments: CommentResponse[]): Map<string | null, CommentResponse[]> {
  const map = new Map<string | null, CommentResponse[]>();
  for (const c of comments) {
    const key = c.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

interface CommentNodeProps {
  comment: CommentResponse;
  tree: Map<string | null, CommentResponse[]>;
  depth: number;
  postId: string;
}

function CommentNode({ comment, tree, depth, postId }: CommentNodeProps) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const addComment = useAddComment();
  const commentIsAnon = isAnon(comment.author.username);
  const displayName = commentIsAnon ? null : comment.author.username;
  const children = tree.get(comment.id) ?? [];
  const visualDepth = Math.min(depth, 2);

  const handleReply = () => {
    if (!replyText.trim()) return;
    addComment.mutate(
      { postId, content: replyText.trim(), parent_id: comment.id },
      { onSuccess: () => { setReplyText(''); setReplying(false); } }
    );
  };

  // At depth > 2 we no longer increase indent — just keep single vertical line.
  const indentPx = visualDepth * 20;

  return (
    <div style={{ paddingLeft: indentPx }}>
      <div style={{
        display: 'flex', gap: 10, paddingTop: 12, paddingBottom: 4,
        borderTop: depth === 0 ? '1px solid var(--border)' : 'none',
        borderLeft: depth > 0 ? '2px solid var(--border)' : 'none',
        paddingLeft: depth > 0 ? 10 : 0,
        marginLeft: depth > 0 ? -10 : 0,
      }}>
        <Avatar name={comment.author.username} src={comment.author.avatar_url ?? undefined} size={28} anon={commentIsAnon} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {commentIsAnon
              ? <AnonLabel scope="campus" />
              : <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</span>}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(comment.created_at)}</span>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.6, color: 'var(--foreground)' }}>{comment.content}</p>
          <button
            onClick={() => setReplying(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            {replying ? 'Cancel' : 'Reply'}
          </button>

          {replying && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to ${commentIsAnon ? 'Anonymous' : displayName}…`}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                  background: 'var(--background)', border: '1px solid var(--border)',
                  borderRadius: 7, fontSize: 13, color: 'var(--foreground)',
                  fontFamily: 'inherit', outline: 'none', resize: 'none', minHeight: 60,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn variant="ghost" size="sm" onClick={() => { setReplying(false); setReplyText(''); }}>Cancel</Btn>
                <Btn size="sm" onClick={handleReply} disabled={addComment.isPending || !replyText.trim()}>
                  {addComment.isPending ? '…' : 'Reply'}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div style={{ marginLeft: depth < 2 ? 20 : 0 }}>
          {children.map(child => (
            <CommentNode key={child.id} comment={child} tree={tree} depth={depth + 1} postId={postId} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostContent({ post, postId }: { post: PostResponse; postId: string }) {
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(true);
  const router = useRouter();
  const { data: comments = [], isLoading: commentsLoading } = useComments(postId);
  const addComment = useAddComment();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);

  const authorIsAnon = post.is_anonymous && isAnon(post.display_author.username);
  const displayName = authorIsAnon ? null : (post.display_author.name || post.display_author.username);
  const trending = post.heat_score > 10;
  const tree = buildTree(comments);
  const roots = tree.get(null) ?? [];

  const handleComment = () => {
    if (!comment.trim()) return;
    addComment.mutate({ postId, content: comment.trim() }, { onSuccess: () => setComment('') });
  };

  return (
    <>
      <button onClick={() => router.push('/feed')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, marginBottom: 24 }}>
        ← Back to feed
      </button>

      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Avatar name={post.display_author.username} src={post.display_author.avatar_url ?? undefined} size={38} anon={authorIsAnon} />
          <div>
            {authorIsAnon
              ? <AnonLabel scope={post.is_global ? 'global' : 'campus'} />
              : <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</span>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(post.created_at)}</span>
              {post.is_global && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Global</span>}
              {trending && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trending</span>}
            </div>
          </div>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 17, lineHeight: 1.65, color: 'var(--foreground)', fontWeight: 400 }}>{post.content}</p>

        {post.image_urls?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ImageCarousel urls={post.image_urls} maxHeight={480} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            onClick={() => handleVote('up')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontSize: 14, fontWeight: localVote === 'up' ? 600 : 400, padding: 0, fontFamily: 'inherit' }}
          >↑ {localUpvotes}</button>
          <button
            onClick={() => handleVote('down')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'down' ? '#C0392B' : 'var(--muted)', fontSize: 14, padding: 0, fontFamily: 'inherit' }}
          >↓</button>
          <button
            onClick={() => setCommentsOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
          >
            💬 {post.comment_count} {commentsOpen ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {commentsOpen && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <Avatar name="You" size={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', resize: 'none', minHeight: 72 }}
              />
              {comment && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Btn variant="ghost" size="sm" onClick={() => setComment('')}>Cancel</Btn>
                  <Btn size="sm" onClick={handleComment} disabled={addComment.isPending}>
                    {addComment.isPending ? 'Posting…' : 'Post'}
                  </Btn>
                </div>
              )}
            </div>
          </div>

          {commentsLoading && <CommentsSkeleton />}

          <div>
            {roots.map(c => (
              <CommentNode key={c.id} comment={c} tree={tree} depth={0} postId={postId} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading: postLoading } = usePost(id);

  if (postLoading) return <ContentShell><PostDetailSkeleton /></ContentShell>;
  if (!post) return <ContentShell><div style={{ color: '#C0392B', fontSize: 14 }}>Post not found.</div></ContentShell>;

  return (
    <ContentShell>
      <PostContent post={post} postId={id} />
    </ContentShell>
  );
}

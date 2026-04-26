'use client';

import { useTweaks } from '@/lib/context';
import { Avatar } from './ui/avatar';
import { AnonLabel } from './ui/anon-label';
import { ImageCarousel } from './ui/image-carousel';
import { formatRelativeTime } from '@/lib/time';
import { usePostVote, type PostResponse } from '@/lib/hooks/useFeed';

interface PostCardProps {
  post: PostResponse;
  onClick?: () => void;
}

const ANON_NAMES = ['Anonymous Peer', 'Anonymous @'];
function isAnonymousDisplay(username: string) { return ANON_NAMES.some(n => username.startsWith(n)); }

export function PostCard({ post, onClick }: PostCardProps) {
  const { cardLayout } = useTweaks();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);

  const isAnon = post.is_anonymous && isAnonymousDisplay(post.display_author.username);
  const displayName = isAnon ? null : (post.display_author.name || post.display_author.username);
  const trending = post.heat_score > 10;

  const cardStyles: Record<string, React.CSSProperties> = {
    open:     { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 8 },
    bordered: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 8 },
    filled:   { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 8 },
  };

  return (
    <div style={{ ...cardStyles[cardLayout], cursor: 'pointer', transition: 'background .15s' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar name={post.display_author.username} src={post.display_author.avatar_url ?? undefined} size={34} anon={isAnon} />
        <div>
          {isAnon
            ? <AnonLabel scope={post.is_global ? 'global' : 'campus'} />
            : <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</span>}
          <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(post.created_at)}</span>
            {post.is_global && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Global</span>}
          </div>
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 15, lineHeight: 1.6, color: 'var(--foreground)' }}>{post.content}</p>

      {post.image_urls?.length > 0 && (
        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 10 }}>
          <ImageCarousel urls={post.image_urls} maxHeight={360} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); handleVote('up'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit', fontWeight: localVote === 'up' ? 600 : 400 }}
        >↑ {localUpvotes}</button>
        <button
          onClick={e => { e.stopPropagation(); handleVote('down'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'down' ? '#C0392B' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
        >↓</button>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>💬 {post.comment_count}</span>
        {trending && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trending</span>}
      </div>
    </div>
  );
}

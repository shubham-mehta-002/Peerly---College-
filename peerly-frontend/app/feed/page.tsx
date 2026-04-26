'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { ContentShell } from '@/components/content-shell';
import { PostCard } from '@/components/post-card';
import { FeedSkeleton } from '@/components/skeletons';
import { useTweaks } from '@/lib/context';
import { useCampusFeed, useGlobalFeed } from '@/lib/hooks/useFeed';

const FILTERS = ['Trending', 'Latest', 'Oldest', 'Most Upvoted'] as const;
type Filter = typeof FILTERS[number];
const SORT_MAP: Record<Filter, 'trending' | 'latest' | 'oldest' | 'upvoted'> = {
  'Trending': 'trending', 'Latest': 'latest', 'Oldest': 'oldest', 'Most Upvoted': 'upvoted',
};

function FeedContent() {
  const [activeFilter, setActiveFilter] = useState<Filter>('Trending');
  const { cardLayout } = useTweaks();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGlobal = searchParams.get('scope') === 'global';
  const sort = SORT_MAP[activeFilter];

  const campusFeed = useCampusFeed(sort);
  const globalFeed = useGlobalFeed(sort);

  const { data: posts = [], isLoading, error } = isGlobal ? globalFeed : campusFeed;

  return (
    <ContentShell>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24, marginTop: -8 }}>
        {[
          { label: 'Campus Feed', href: '/feed', active: !isGlobal },
          { label: 'Global Feed', href: '/feed?scope=global', active: isGlobal },
        ].map(tab => (
          <button key={tab.label} onClick={() => router.push(tab.href)} style={{
            padding: '12px 0', marginRight: 28, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: tab.active ? 600 : 400,
            color: tab.active ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: tab.active ? '2px solid var(--foreground)' : '2px solid transparent',
            transition: 'all .15s', marginBottom: -1,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)} style={{
            padding: '5px 12px', borderRadius: 999,
            border: `1px solid ${activeFilter === f ? 'var(--accent)' : 'var(--border)'}`,
            background: activeFilter === f ? 'var(--accent)' : 'transparent',
            color: activeFilter === f ? '#fff' : 'var(--muted)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && <FeedSkeleton />}
      {error && <div style={{ color: '#C0392B', fontSize: 14 }}>Failed to load posts.</div>}

      {!isLoading && !error && posts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20, lineHeight: 1 }}>✦</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>
            No posts yet
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 280 }}>
            {isGlobal
              ? 'Nobody has posted to the global feed yet. Be the first voice your peers will hear.'
              : 'Your campus feed is empty. Break the silence — your peers are waiting.'}
          </p>
          <Link href="/posts/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, padding: '9px 20px',
            borderRadius: 8, textDecoration: 'none', transition: 'opacity .15s',
          }}>
            + Post — be the first
          </Link>
          <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            or use the <strong style={{ color: 'var(--foreground)' }}>+ Post</strong> button in the navbar
          </p>
        </div>
      )}

      <div style={cardLayout === 'open' ? {} : { display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onClick={() => router.push(`/posts/${post.id}`)}
          />
        ))}
      </div>
    </ContentShell>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<ContentShell><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div></ContentShell>}>
      <FeedContent />
    </Suspense>
  );
}

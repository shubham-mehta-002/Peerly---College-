import Skeleton from 'react-loading-skeleton';

export function PostCardSkeleton() {
  return (
    <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Skeleton circle width={34} height={34} />
        <div>
          <Skeleton width={110} height={13} />
          <Skeleton width={70} height={11} style={{ marginTop: 4 }} />
        </div>
      </div>
      <Skeleton count={2} height={15} style={{ marginBottom: 4 }} />
      <Skeleton width="50%" height={15} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 16 }}>
        <Skeleton width={40} height={13} />
        <Skeleton width={24} height={13} />
        <Skeleton width={40} height={13} />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </>
  );
}

export function PostDetailSkeleton() {
  return (
    <>
      <Skeleton width={100} height={13} style={{ marginBottom: 24 }} />
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Skeleton circle width={38} height={38} />
          <div>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
          </div>
        </div>
        <Skeleton count={3} height={17} style={{ marginBottom: 5 }} />
        <Skeleton width="65%" height={17} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 18 }}>
          <Skeleton width={44} height={14} />
          <Skeleton width={24} height={14} />
          <Skeleton width={60} height={14} />
        </div>
      </div>
      <CommentsSkeleton />
    </>
  );
}

export function CommentsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, paddingTop: 12, paddingBottom: 4, borderTop: '1px solid var(--border)' }}>
          <Skeleton circle width={28} height={28} />
          <div style={{ flex: 1 }}>
            <Skeleton width={100} height={13} style={{ marginBottom: 6 }} />
            <Skeleton count={2} height={14} style={{ marginBottom: 3 }} />
            <Skeleton width="40%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
        <Skeleton circle width={68} height={68} />
        <div style={{ flex: 1 }}>
          <Skeleton width={160} height={20} style={{ marginBottom: 6 }} />
          <Skeleton width={90} height={13} style={{ marginBottom: 8 }} />
          <Skeleton width={220} height={13} />
        </div>
      </div>
      <Skeleton height={1} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <Skeleton width={50} height={14} />
        <Skeleton width={80} height={14} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </>
  );
}

export function CommunityItemSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
      <Skeleton width={44} height={44} borderRadius={10} />
      <div style={{ flex: 1 }}>
        <Skeleton width={140} height={14} style={{ marginBottom: 5 }} />
        <Skeleton width={200} height={12} />
      </div>
      <Skeleton width={44} height={28} borderRadius={6} />
    </div>
  );
}

export function CommunitiesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CommunityItemSkeleton key={i} />
      ))}
    </>
  );
}

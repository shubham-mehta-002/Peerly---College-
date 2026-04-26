'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/btn';
import { Divider } from '@/components/ui/divider';
import { useMe, useLogout } from '@/lib/hooks/useAuth';
import { useMyProfile, usePublicProfile } from '@/lib/hooks/useProfile';
import { ProfileSkeleton } from '@/components/skeletons';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'anonymous'>('posts');
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const logout = useLogout();

  const { data: me, isLoading: meLoading } = useMe();
  const isSelf = !username || username === 'me' || username === me?.profile?.username;

  const { data: myProfile, isLoading: myLoading } = useMyProfile();
  const { data: publicProfile, isLoading: pubLoading } = usePublicProfile(isSelf ? '' : username);

  const isLoading = meLoading || (isSelf ? myLoading : pubLoading);
  const profile = isSelf ? myProfile : publicProfile;

  if (isLoading) {
    return <ContentShell><ProfileSkeleton /></ContentShell>;
  }

  if (!profile) {
    return <ContentShell><div style={{ color: '#C0392B', fontSize: 14 }}>Profile not found.</div></ContentShell>;
  }

  const displayName = profile.name ?? (isSelf ? me?.email : profile.username) ?? 'Unknown';
  const uname = profile.username ?? '';
  const bio = profile.bio ?? '';

  return (
    <ContentShell>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
        <Avatar name={displayName} src={profile.avatar_url ?? undefined} size={68} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>{displayName}</h1>
            {uname && <span style={{ fontSize: 13, color: 'var(--muted)' }}>@{uname}</span>}
          </div>
          {bio && <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{bio}</p>}
        </div>
        {isSelf && (
          <Btn variant="secondary" size="sm" onClick={() => router.push('/profile/edit')}>Edit profile</Btn>
        )}
      </div>

      <Divider />

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', margin: '0 0 20px' }}>
        {(isSelf
          ? [['posts', 'Posts'], ['anonymous', 'Anonymous']] as const
          : [['posts', 'Posts']] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as typeof activeTab)} style={{
            padding: '12px 0', marginRight: 24, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: activeTab === id ? 600 : 400,
            color: activeTab === id ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: activeTab === id ? '2px solid var(--foreground)' : '2px solid transparent', marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'posts' ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Posts will appear here.</div>
        </div>
      ) : (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            Anonymous posts are only visible to you.
          </div>
        </div>
      )}

      {isSelf && (
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Account settings
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Privacy
          </button>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#C0392B', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Sign out
          </button>
        </div>
      )}
    </ContentShell>
  );
}

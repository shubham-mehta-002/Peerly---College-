'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/btn';
import { useMyProfile, useUpdateProfile } from '@/lib/hooks/useProfile';
import { uploadImage } from '@/lib/cloudinary';

export default function ProfileEditPage() {
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  if (isLoading) {
    return <ContentShell><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div></ContentShell>;
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);
    try {
      let avatar_url = profile?.avatar_url ?? undefined;
      if (avatarFile) {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(avatarFile, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
        avatar_url = await uploadImage(compressed as File);
      }
      await updateProfile.mutateAsync({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar_url,
      });
      router.push('/profile/me');
    } catch {
      setError('Failed to save profile');
    } finally {
      setUploading(false);
    }
  };

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? undefined;
  const displayName = name || profile?.username || 'You';
  const isPending = uploading || updateProfile.isPending;

  return (
    <ContentShell maxWidth={520}>
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, marginBottom: 24 }}
      >
        ← Cancel
      </button>

      <h1 style={{ margin: '0 0 28px', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>Edit profile</h1>

      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={displayName} src={currentAvatar} size={72} />
            <label style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Change</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </label>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Hover avatar to change photo</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Display name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 200))}
              placeholder="A short bio…"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', resize: 'none' }}
            />
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{200 - bio.length}</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,.08)', border: '1px solid #C0392B', borderRadius: 8, fontSize: 13, color: '#C0392B', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" size="md" onClick={() => router.back()}>Cancel</Btn>
          <Btn size="md" disabled={isPending}>
            {isPending ? (uploading ? 'Uploading…' : 'Saving…') : 'Save changes'}
          </Btn>
        </div>
      </form>
    </ContentShell>
  );
}

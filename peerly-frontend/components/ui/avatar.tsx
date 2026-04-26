'use client';

import { useTweaks } from '@/lib/context';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  anon?: boolean;
}

export function Avatar({ name = '?', src, size = 32, anon = false }: AvatarProps) {
  const { anonStyle } = useTweaks();
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const s: React.CSSProperties = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  if (anon) {
    const char = anonStyle === 'ghost' ? '?' : '—';
    return (
      <div style={{ ...s, background: 'var(--border)', color: 'var(--muted)', fontSize: size * 0.4, fontWeight: 600, letterSpacing: anonStyle === 'ghost' ? undefined : '-0.5px' }}>
        {char}
      </div>
    );
  }

  if (src) {
    return <img src={src} alt={name} style={{ ...s, objectFit: 'cover' }} />;
  }

  return (
    <div style={{ ...s, background: 'var(--accent)', color: '#fff', fontSize: size * 0.38, fontWeight: 600 }}>
      {initials}
    </div>
  );
}

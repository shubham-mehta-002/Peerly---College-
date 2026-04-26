'use client';

import { useTweaks } from '@/lib/context';

interface AnonLabelProps {
  scope?: 'campus' | 'global';
}

export function AnonLabel({ scope = 'campus' }: AnonLabelProps) {
  const { anonStyle } = useTweaks();
  const text = scope === 'global' ? 'Anonymous @ Thapar University' : 'Anonymous Peer';

  if (anonStyle === 'badge') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 999,
        background: 'var(--card)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 500, color: 'var(--muted)',
      }}>
        <span style={{ opacity: 0.6 }}>◯</span> {text}
      </span>
    );
  }

  if (anonStyle === 'ghost') {
    return <span style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>{text}</span>;
  }

  return <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text}</span>;
}

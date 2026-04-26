'use client';

import React from 'react';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Btn({ children, variant = 'primary', size = 'md', onClick, style: extStyle, disabled, type = 'button' }: BtnProps) {
  const sizes: Record<BtnSize, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '10px 18px', fontSize: 14 },
    lg: { padding: '13px 24px', fontSize: 15 },
  };

  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8 },
    secondary: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 },
    ghost: { background: 'transparent', color: 'var(--muted)', border: 'none', borderRadius: 8 },
    danger: { background: 'transparent', color: '#C0392B', border: '1px solid #C0392B', borderRadius: 8 },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', fontWeight: 500,
        transition: 'opacity .15s', opacity: disabled ? 0.45 : 1,
        ...sizes[size], ...variants[variant], ...extStyle,
      }}
    >
      {children}
    </button>
  );
}

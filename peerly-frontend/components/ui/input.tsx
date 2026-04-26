'use client';

import React, { useState } from 'react';

interface InputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  hint?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  showToggle?: boolean;
}

export function Input({ label, placeholder, type = 'text', value, onChange, hint, error, multiline, rows = 3, showToggle }: InputProps) {
  const [showPwd, setShowPwd] = useState(false);

  const isPassword = type === 'password';
  const effectiveType = isPassword && showToggle ? (showPwd ? 'text' : 'password') : type;

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: isPassword && showToggle ? '10px 40px 10px 12px' : '10px 12px',
    background: 'var(--background)', border: `1px solid ${error ? '#C0392B' : 'var(--border)'}`,
    borderRadius: 8, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit',
    outline: 'none', resize: multiline ? 'vertical' : undefined,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{label}</label>}
      {multiline ? (
        <textarea style={inputStyle} placeholder={placeholder} value={value} onChange={onChange} rows={rows} />
      ) : isPassword && showToggle ? (
        <div style={{ position: 'relative' }}>
          <input
            style={inputStyle}
            type={effectiveType}
            placeholder={placeholder}
            value={value}
            onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--muted)', display: 'flex', alignItems: 'center', lineHeight: 1,
            }}
          >
            {showPwd ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        <input
          style={inputStyle}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
        />
      )}
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: '#C0392B' }}>{error}</span>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

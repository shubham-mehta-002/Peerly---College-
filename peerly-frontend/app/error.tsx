'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'var(--background)',
    }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4 }}>⚠</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.2px' }}>
          Something went wrong
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Btn } from '@/components/ui/btn';
import { Input } from '@/components/ui/input';
import { useResetPassword } from '@/lib/hooks/useAuth';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();

  const mismatch = confirm.length > 0 && password !== confirm;
  const weak = password.length > 0 && password.length < 8;
  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', '#C0392B', '#E67E22', 'var(--accent)'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!token && (
        <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,.08)', border: '1px solid #C0392B', borderRadius: 8, fontSize: 13, color: '#C0392B' }}>
          Invalid reset link. Request a new one.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input label="New password" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} error={weak ? 'At least 8 characters' : ''} />
        {password.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength ? strengthColor[strength] : 'var(--border)', transition: 'background .2s' }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: strengthColor[strength], fontWeight: 500, minWidth: 40 }}>{strengthLabel[strength]}</span>
          </div>
        )}
      </div>
      <Input label="Confirm password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} error={mismatch ? "Passwords don't match" : ''} />
      {reset.error && (
        <div style={{ fontSize: 13, color: '#C0392B' }}>{(reset.error as Error & { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Reset failed'}</div>
      )}
      <Btn disabled={!password || !confirm || mismatch || weak || !token || reset.isPending} onClick={() => reset.mutate({ token, newPassword: password })} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
        {reset.isPending ? 'Saving…' : 'Set new password'}
      </Btn>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>Choose a new password</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Min. 8 characters.</p>
        </div>
        <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

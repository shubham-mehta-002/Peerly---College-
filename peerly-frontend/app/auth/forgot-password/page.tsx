'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui/btn';
import { Input } from '@/components/ui/input';
import { useForgotPassword } from '@/lib/hooks/useAuth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const forgot = useForgotPassword();

  const handleSend = () => {
    if (!email.trim()) return;
    forgot.mutate({ email }, { onSuccess: () => setSent(true) });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <button onClick={() => router.push('/auth/login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', padding: 0, marginBottom: 36 }}>
          ← Back to sign in
        </button>

        {!sent ? (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>Reset your password</h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Enter your college email and we'll send a reset link.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="College email" placeholder="yourname@thapar.edu" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <Btn disabled={!email.trim() || forgot.isPending} onClick={handleSend} style={{ width: '100%', justifyContent: 'center' }}>
                {forgot.isPending ? 'Sending…' : 'Send reset link'}
              </Btn>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 20px' }}>✉</div>
            <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>Check your inbox</h1>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
              We sent a reset link to <strong style={{ color: 'var(--foreground)' }}>{email}</strong>. Expires in 60 minutes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="secondary" onClick={() => setSent(false)} style={{ width: '100%', justifyContent: 'center' }}>Resend email</Btn>
              <button onClick={() => router.push('/auth/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

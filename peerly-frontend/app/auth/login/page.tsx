'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui/btn';
import { Input } from '@/components/ui/input';
import { useLogin, useRegister, useVerifyEmail, useResendOTP, useGoogleAuth, useCheckDomain, type DomainCheckResult } from '@/lib/hooks/useAuth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = PASSWORD_RULES.filter(r => r.test(password)).length;
  const color = passed <= 2 ? '#C0392B' : passed <= 3 ? '#E67E22' : passed <= 4 ? '#F1C40F' : '#27AE60';

  return (
    <div style={{ marginTop: -8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {PASSWORD_RULES.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < passed ? color : 'var(--border)',
            transition: 'background .2s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
        {PASSWORD_RULES.map(r => (
          <span key={r.label} style={{ fontSize: 11, color: r.test(password) ? '#27AE60' : 'var(--muted)' }}>
            {r.test(password) ? '✓' : '○'} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DomainChecker({ email }: { email: string }) {
  const checkDomain = useCheckDomain();
  const [result, setResult] = useState<DomainCheckResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChecked = useRef('');

  useEffect(() => {
    const domain = email.split('@')[1];
    if (!domain || domain.length < 3 || domain === lastChecked.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      lastChecked.current = domain;
      try {
        const data = await checkDomain.mutateAsync(email);
        setResult(data);
      } catch {
        setResult(null);
      }
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [email]);

  if (!email.includes('@') || !email.split('@')[1]) {
    return (
      <div style={{ padding: '10px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
        Enter your college email above to check if your institution is supported.
      </div>
    );
  }

  if (checkDomain.isPending) {
    return (
      <div style={{ padding: '10px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
        Checking domain…
      </div>
    );
  }

  if (!result) return null;

  const configs: Record<string, { bg: string; border: string; color: string; icon: string; text: string }> = {
    active: { bg: 'rgba(39,174,96,.08)', border: '#27AE60', color: '#27AE60', icon: '✓', text: `${result.college_name ?? result.domain} is supported` },
    inactive: { bg: 'rgba(230,126,34,.08)', border: '#E67E22', color: '#E67E22', icon: '⚠', text: `${result.college_name ?? result.domain} is currently inactive` },
    not_found: { bg: 'rgba(192,57,43,.08)', border: '#C0392B', color: '#C0392B', icon: '✗', text: `@${result.domain} is not a whitelisted domain` },
    invalid: { bg: 'rgba(192,57,43,.08)', border: '#C0392B', color: '#C0392B', icon: '✗', text: 'Invalid email format' },
  };

  const cfg = configs[result.status];
  if (!cfg) return null;

  return (
    <div style={{ padding: '10px 14px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, fontSize: 13, color: cfg.color, lineHeight: 1.5 }}>
      {cfg.icon} {cfg.text}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [pendingEmail, setPendingEmail] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const router = useRouter();
  const login = useLogin();
  const register = useRegister();
  const verifyEmail = useVerifyEmail();
  const resendOTP = useResendOTP();
  const googleAuth = useGoogleAuth();

  const googleInitialized = useRef(false);

  useEffect(() => {
    if (googleInitialized.current) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          googleAuth.mutate(response.credential);
        },
        auto_select: false,
      });
      googleInitialized.current = true;
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleGoogleClick = () => {
    window.google?.accounts.id.prompt();
  };

  const handleTabSwitch = (t: 'login' | 'signup') => {
    setTab(t);
    login.reset();
    register.reset();
    googleAuth.reset();
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (login.error) login.reset();
    if (register.error) register.reset();
  };

  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (login.error) login.reset();
  };

  const handleLogin = () => {
    if (!email || !password) return;
    login.mutate({ email, password });
  };

  const handleRegister = () => {
    if (!email || !password || password !== confirmPassword) return;
    register.mutate({ email, password }, {
      onSuccess: data => {
        setPendingEmail(data.email);
        setStep('otp');
      },
    });
  };

  const handleVerify = () => {
    if (otp.length !== 6) return;
    verifyEmail.mutate({ email: pendingEmail, otp });
  };

  const handleResend = () => {
    resendOTP.mutate(pendingEmail);
  };

  type ApiError = Error & { response?: { data?: { error?: string } } };
  const getError = (mut: { error: unknown }) => {
    const e = mut.error as ApiError | null;
    return e?.response?.data?.error ?? e?.message ?? null;
  };

  const loginError = getError(login);
  const registerError = getError(register);
  const verifyError = getError(verifyEmail);
  const googleError = getError(googleAuth);

  if (step === 'otp') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.5px', marginBottom: 6 }}>Peerly</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Your campus, your community.</div>
        </div>

        <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 28px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Verify your email</h2>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below to activate your account.
          </p>

          {verifyError && (
            <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,.08)', border: '1px solid #C0392B', borderRadius: 8, fontSize: 13, color: '#C0392B', marginBottom: 16 }}>
              {verifyError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Verification code"
              placeholder="000000"
              value={otp}
              onChange={e => { setOtp(e.target.value); if (verifyEmail.error) verifyEmail.reset(); }}
            />
            <Btn onClick={handleVerify} disabled={verifyEmail.isPending || otp.length !== 6} style={{ width: '100%', justifyContent: 'center' }}>
              {verifyEmail.isPending ? 'Verifying…' : 'Verify email'}
            </Btn>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Didn't receive it?{' '}
              <button
                onClick={handleResend}
                disabled={resendOTP.isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 13, padding: 0 }}
              >
                {resendOTP.isPending ? 'Sending…' : resendOTP.isSuccess ? 'Sent!' : 'Resend code'}
              </button>
            </div>
            <button
              onClick={() => { setStep('auth'); setOtp(''); verifyEmail.reset(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, padding: 0, textAlign: 'center' }}
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.5px', marginBottom: 6 }}>Peerly</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Your campus, your community.</div>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['login', 'signup'] as const).map(t => (
            <button key={t} onClick={() => handleTabSwitch(t)} style={{
              flex: 1, padding: 14, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--foreground)' : 'var(--muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all .15s', marginBottom: -1,
            }}>
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px 28px' }}>
          {(loginError || registerError || googleError) && (
            <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,.08)', border: '1px solid #C0392B', borderRadius: 8, fontSize: 13, color: '#C0392B', marginBottom: 16 }}>
              {loginError || registerError || googleError}
              {loginError?.includes('verify your email') && (
                <button
                  onClick={() => { setPendingEmail(email); setStep('otp'); login.reset(); }}
                  style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', fontFamily: 'inherit', fontSize: 12, padding: 0, textDecoration: 'underline' }}
                >
                  Verify email now →
                </button>
              )}
            </div>
          )}

          {tab === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="College email" placeholder="yourname@thapar.edu" type="email" value={email} onChange={e => handleEmailChange(e.target.value)} />
              <Input label="Password" placeholder="••••••••" type="password" showToggle value={password} onChange={e => handlePasswordChange(e.target.value)} />
              <div style={{ textAlign: 'right', marginTop: -8 }}>
                <button onClick={() => router.push('/auth/forgot-password')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontFamily: 'inherit', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <Btn onClick={handleLogin} disabled={login.isPending || !email || !password} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Btn>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <Btn variant="secondary" onClick={handleGoogleClick} style={{ width: '100%', justifyContent: 'center' }}>
                <GoogleIcon /> Continue with Google
              </Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="College email" placeholder="yourname@thapar.edu" type="email" value={email} onChange={e => handleEmailChange(e.target.value)} />
              <DomainChecker email={email} />
              <Input label="Password" placeholder="Min. 8 characters" type="password" showToggle value={password} onChange={e => setPassword(e.target.value)} />
              <PasswordStrength password={password} />
              <Input
                label="Confirm password"
                placeholder="••••••••"
                type="password"
                showToggle
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : ''}
              />
              <Btn onClick={handleRegister} disabled={register.isPending || !email || !password || password !== confirmPassword} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {register.isPending ? 'Creating account…' : 'Create account'}
              </Btn>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <Btn variant="secondary" onClick={handleGoogleClick} style={{ width: '100%', justifyContent: 'center' }}>
                <GoogleIcon /> Continue with Google
              </Btn>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
        By signing up you agree to our Terms of Service. Peerly is exclusively for students of whitelisted institutions.
      </p>
    </div>
  );
}

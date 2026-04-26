'use client';

import { useState, useEffect } from 'react';
import { Btn } from '@/components/ui/btn';
import { Input } from '@/components/ui/input';
import { useOnboardingCampuses, useCompleteOnboarding, useCheckUsername } from '@/lib/hooks/useAuth';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [campusId, setCampusId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const { data: campuses = [], isLoading: loadingCampuses } = useOnboardingCampuses();
  const complete = useCompleteOnboarding();
  const checkUsername = useCheckUsername();

  const steps = ['Campus', 'Profile', 'Done'];

  useEffect(() => {
    if (username.length < 3) { setUsernameState('idle'); return; }
    setUsernameState('checking');
    const t = setTimeout(() => {
      checkUsername.mutate(username, {
        onSuccess: d => setUsernameState(d.available ? 'available' : 'taken'),
        onError: () => setUsernameState('idle'),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [username]);

  const handleComplete = () => {
    if (!name || !username || !campusId || usernameState !== 'available') return;
    complete.mutate({ name, username, bio: bio || undefined, campus_id: campusId });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>Peerly</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'contents' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: i <= step ? 'var(--accent)' : 'var(--border)', color: i <= step ? '#fff' : 'var(--muted)', transition: 'all .25s' }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i <= step ? 'var(--foreground)' : 'var(--muted)', fontWeight: i === step ? 600 : 400, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 2, height: 1, background: i < step ? 'var(--accent)' : 'var(--border)', marginBottom: 22, transition: 'background .25s' }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 28px' }}>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>Select your campus</h2>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>Your campus is locked after setup and determines which content you see.</p>
              </div>
              {loadingCampuses ? (
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>Loading campuses…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {campuses.map(c => (
                    <button key={c.id} onClick={() => setCampusId(c.id)} style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: 8,
                      border: `1px solid ${campusId === c.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: campusId === c.id ? 'rgba(45,106,79,.07)' : 'var(--background)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
                      color: 'var(--foreground)', fontWeight: campusId === c.id ? 600 : 400, transition: 'all .15s',
                    }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <Btn disabled={!campusId} onClick={() => setStep(1)} style={{ alignSelf: 'flex-end' }}>Continue →</Btn>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>Set up your profile</h2>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>You can always update this later.</p>
              </div>
              <Input label="Full name" placeholder="Priya Sharma" value={name} onChange={e => setName(e.target.value)} />
              <Input label="Username" placeholder="priya_sharma" value={username} onChange={e => setUsername(e.target.value)}
                hint={usernameState === 'available' ? '✓ Username is available' : usernameState === 'checking' ? 'Checking…' : 'Letters, numbers, underscores only'}
                error={usernameState === 'taken' ? 'This username is taken' : ''} />
              <Input label="Bio" placeholder="2nd year CSE, loves football and bad puns" multiline rows={2} value={bio} onChange={e => setBio(e.target.value)} />
              {complete.error && (
                <div style={{ fontSize: 13, color: '#C0392B' }}>{(complete.error as Error & { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong'}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Btn variant="ghost" onClick={() => setStep(0)}>← Back</Btn>
                <Btn onClick={handleComplete} disabled={!name || usernameState !== 'available' || complete.isPending}>
                  {complete.isPending ? 'Saving…' : 'Save & Continue →'}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

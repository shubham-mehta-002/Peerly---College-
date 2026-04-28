'use client';

import { useState } from 'react';
import { useReportPost } from '@/lib/hooks/useReports';

const REASONS = [
  { value: 'spam',          label: 'Spam' },
  { value: 'harassment',    label: 'Harassment' },
  { value: 'misinformation',label: 'Misinformation' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other',         label: 'Other' },
] as const;

type Reason = typeof REASONS[number]['value'];

interface ReportModalProps {
  postId: string;
  onClose: () => void;
}

export function ReportModal({ postId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');
  const report = useReportPost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { setError('Select a reason'); return; }
    if (reason === 'other' && !customText.trim()) { setError('Please describe the issue'); return; }
    setError('');
    try {
      await report.mutateAsync({ postId, reason, customText: reason === 'other' ? customText.trim() : undefined });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit report');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 380, width: '100%' }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Report post</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {REASONS.map(r => (
              <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--foreground)' }}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  style={{ cursor: 'pointer' }}
                />
                {r.label}
              </label>
            ))}
          </div>
          {reason === 'other' && (
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Describe the issue…"
              maxLength={500}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', resize: 'vertical', minHeight: 80, marginBottom: 12, outline: 'none' }}
            />
          )}
          {error && <div style={{ fontSize: 13, color: '#C0392B', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={report.isPending} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: report.isPending ? 0.6 : 1 }}>
              {report.isPending ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

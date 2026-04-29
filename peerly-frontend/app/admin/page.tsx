'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { useAdminColleges, useCreateCollege, useUpdateCollege } from '@/lib/hooks/useAdmin';
import { useMe } from '@/lib/hooks/useAuth';
import { useAdminReports, useHidePost, useUnhidePost, type PostReportSummary } from '@/lib/hooks/useReports';
import { formatRelativeTime } from '@/lib/time';

function CollegeRow({
  college,
  onToggle,
  onClick,
}: {
  college: { id: string; name: string; is_active: boolean; college_domains: [{ count: number }]; campuses: [{ count: number }] };
  onToggle: () => void;
  onClick: () => void;
}) {
  const domainCount = college.college_domains?.[0]?.count ?? 0;
  const campusCount = college.campuses?.[0]?.count ?? 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
      <div onClick={onClick} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{college.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
            border: `1px solid ${college.is_active ? 'var(--accent)' : 'var(--border)'}`,
            color: college.is_active ? 'var(--accent)' : 'var(--muted)',
            background: 'transparent',
          }}>
            {college.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {domainCount} domain{domainCount !== 1 ? 's' : ''} · {campusCount} campus{campusCount !== 1 ? 'es' : ''}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          padding: '5px 12px', borderRadius: 6, flexShrink: 0,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted)', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {college.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: colleges = [], isLoading } = useAdminColleges();
  const createCollege = useCreateCollege();
  const updateCollege = useUpdateCollege();

  const [adminTab, setAdminTab] = useState<'colleges' | 'reports'>('colleges');
  const [reportFilter, setReportFilter] = useState<string>('');
  const [reportPage, setReportPage] = useState(1);
  const { data: reports = [], isLoading: reportsLoading } = useAdminReports(reportFilter || undefined, reportPage);
  const hidePost = useHidePost();
  const unhidePost = useUnhidePost();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');

  if (meLoading) return null;
  if (!me?.is_admin) {
    router.replace('/feed');
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!newName.trim()) return;
    try {
      await createCollege.mutateAsync({ name: newName.trim() });
      setNewName('');
      setShowForm(false);
    } catch {
      setFormError('Failed to create college');
    }
  }

  return (
    <ContentShell>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {([['colleges', 'Colleges'], ['reports', 'Reports']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAdminTab(id)} style={{
            padding: '10px 0', marginRight: 24, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: adminTab === id ? 600 : 400,
            color: adminTab === id ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: adminTab === id ? '2px solid var(--foreground)' : '2px solid transparent', marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {adminTab === 'colleges' && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Admin
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>
                Colleges
              </h1>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              style={{
                padding: '7px 16px', borderRadius: 7, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Add College
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 16, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>New College</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="College name"
                  style={{
                    flex: 1, padding: '8px 12px', background: 'var(--background)',
                    border: '1px solid var(--border)', borderRadius: 7,
                    fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={createCollege.isPending || !newName.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: 7, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: createCollege.isPending ? 0.6 : 1,
                  }}
                >
                  {createCollege.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setNewName(''); setFormError(''); }}
                  style={{
                    padding: '8px 12px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
              {formError && <div style={{ marginTop: 8, fontSize: 12, color: '#e55' }}>{formError}</div>}
            </form>
          )}

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
            {colleges.length} college{colleges.length !== 1 ? 's' : ''}
          </div>

          {isLoading && <div style={{ color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>Loading…</div>}

          <div>
            {colleges.map(c => (
              <CollegeRow
                key={c.id}
                college={c}
                onClick={() => router.push(`/admin/colleges/${c.id}`)}
                onToggle={() => updateCollege.mutate({ id: c.id, is_active: !c.is_active })}
              />
            ))}
          </div>
        </>
      )}

      {adminTab === 'reports' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Reported Posts</h2>
            <select
              value={reportFilter}
              onChange={e => { setReportFilter(e.target.value); setReportPage(1); }}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="">All reasons</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="misinformation">Misinformation</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
          </div>

          {reportsLoading && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading reports…</div>}

          {!reportsLoading && reports.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>No reported posts.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {reports.map((r: PostReportSummary, i: number) => (
              <div key={r.id} style={{ padding: '16px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {r.author.name || r.author.username}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(r.created_at)}</span>
                      {r.is_hidden && (
                        <span style={{ fontSize: 11, color: '#C0392B', border: '1px solid rgba(192,57,43,.4)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>Hidden</span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {r.content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                        {r.report_count} report{r.report_count !== 1 ? 's' : ''}
                      </span>
                      {Object.entries(r.reason_breakdown).map(([reason, count]) => (
                        <span key={reason} style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                          {reason}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                  {r.is_hidden ? (
                    <button
                      onClick={() => unhidePost.mutate(r.id)}
                      disabled={unhidePost.isPending}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        fontFamily: 'inherit', cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--muted)', opacity: unhidePost.isPending ? 0.6 : 1,
                      }}
                    >
                      Unhide
                    </button>
                  ) : (
                    <button
                      onClick={() => hidePost.mutate(r.id)}
                      disabled={hidePost.isPending}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        fontFamily: 'inherit', cursor: 'pointer',
                        border: '1px solid rgba(192,57,43,.4)', background: 'transparent',
                        color: '#C0392B', opacity: hidePost.isPending ? 0.6 : 1,
                      }}
                    >
                      Hide post
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {reports.length === 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setReportPage(p => Math.max(1, p - 1))}
                disabled={reportPage === 1}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: reportPage === 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '30px' }}>Page {reportPage}</span>
              <button
                onClick={() => setReportPage(p => p + 1)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >Next →</button>
            </div>
          )}
        </div>
      )}
    </ContentShell>
  );
}

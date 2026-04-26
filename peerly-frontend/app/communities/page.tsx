'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { Btn } from '@/components/ui/btn';
import { useCommunities, useJoinCommunity, useLeaveCommunity, useCreateCommunity } from '@/lib/hooks/useCommunities';
import { CommunitiesListSkeleton } from '@/components/skeletons';

const CATS = ['All', 'Technical', 'Cultural', 'Sports'];
const CATEGORY_ICON: Record<string, string> = { Technical: '⌨', Cultural: '♪', Sports: '⚽' };

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');
  const [activeCat, setActiveCat] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<'Technical' | 'Cultural' | 'Sports'>('Technical');
  const [createError, setCreateError] = useState('');
  const router = useRouter();

  const { data: all = [], isLoading } = useCommunities(search || undefined);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const createCommunity = useCreateCommunity();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError('');
    try {
      const c = await createCommunity.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined, category: newCat });
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewCat('Technical');
      router.push(`/communities/${c.id}`);
    } catch {
      setCreateError('Failed to create community');
    }
  };

  const joined = all.filter(c => c.user_role !== null);
  const displayed = (activeTab === 'joined' ? joined : all).filter(c =>
    activeCat === 'All' || c.category === activeCat
  );

  return (
    <ContentShell>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>Communities</h1>
        </div>
        <Btn size="sm" onClick={() => setShowCreate(v => !v)}>+ New</Btn>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>New Community</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Community name"
              style={{ padding: '8px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none' }}
            />
            <input
              value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              style={{ padding: '8px 12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Technical', 'Cultural', 'Sports'] as const).map(cat => (
                <button key={cat} type="button" onClick={() => setNewCat(cat)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${newCat === cat ? 'var(--accent)' : 'var(--border)'}`, background: newCat === cat ? 'var(--accent)' : 'transparent', color: newCat === cat ? '#fff' : 'var(--muted)' }}>
                  {cat}
                </button>
              ))}
            </div>
            {createError && <div style={{ fontSize: 12, color: '#C0392B' }}>{createError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={createCommunity.isPending || !newName.trim()} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: createCommunity.isPending ? 0.6 : 1 }}>
                {createCommunity.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['discover', 'Discover'], ['joined', `Joined (${joined.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 0', marginRight: 24, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: activeTab === id ? 600 : 400,
            color: activeTab === id ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: activeTab === id ? '2px solid var(--foreground)' : '2px solid transparent', marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, pointerEvents: 'none' }}>⌕</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search communities…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setActiveCat(c)} style={{
            padding: '4px 12px', borderRadius: 999,
            border: `1px solid ${activeCat === c ? 'var(--accent)' : 'var(--border)'}`,
            background: activeCat === c ? 'var(--accent)' : 'transparent',
            color: activeCat === c ? '#fff' : 'var(--muted)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>
            {c}
          </button>
        ))}
      </div>

      {isLoading && <CommunitiesListSkeleton />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {displayed.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <div onClick={() => router.push(`/communities/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, cursor: 'pointer', minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {CATEGORY_ICON[c.category] || '•'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>{c.category}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.member_count}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>members</div>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); c.user_role ? leave.mutate(c.id) : join.mutate(c.id); }}
              style={{
                padding: '5px 12px', borderRadius: 6, flexShrink: 0,
                border: `1px solid ${c.user_role ? 'var(--border)' : 'var(--accent)'}`,
                background: c.user_role ? 'transparent' : 'var(--accent)',
                color: c.user_role ? 'var(--muted)' : '#fff',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {c.user_role ? 'Leave' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </ContentShell>
  );
}

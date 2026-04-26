'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import {
  useAdminColleges,
  useAdminDomains,
  useAdminCampuses,
  useUpdateCollege,
  useCreateDomain,
  useUpdateDomain,
  useCreateCampus,
  useUpdateCampus,
  type DomainResponse,
  type CampusResponse,
} from '@/lib/hooks/useAdmin';
import { useMe } from '@/lib/hooks/useAuth';

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.1px' }}>{title}</div>
      <button
        onClick={onAdd}
        style={{
          padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--muted)',
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        + Add
      </button>
    </div>
  );
}

function AddForm({
  placeholder,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  placeholder: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string;
}) {
  const [value, setValue] = useState('');

  return (
    <div style={{ padding: 12, background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onSave(value.trim()); } }}
          style={{
            flex: 1, padding: '7px 10px', background: 'var(--background)',
            border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 13, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => { if (value.trim()) onSave(value.trim()); }}
          disabled={isPending || !value.trim()}
          style={{
            padding: '7px 14px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? '…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '7px 10px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#e55' }}>{error}</div>}
    </div>
  );
}

function DomainItem({ domain, collegeId }: { domain: DomainResponse; collegeId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(domain.domain);
  const updateDomain = useUpdateDomain();

  const saveRename = async () => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === domain.domain) { setEditing(false); return; }
    await updateDomain.mutateAsync({ collegeId, domainId: domain.id, domain: trimmed });
    setEditing(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setValue(domain.domain); setEditing(false); } }}
          style={{
            flex: 1, padding: '4px 8px', background: 'var(--background)',
            border: '1px solid var(--border)', borderRadius: 5,
            fontSize: 13, color: 'var(--foreground)', fontFamily: 'monospace', outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => { setValue(domain.domain); setEditing(true); }}
          style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', fontFamily: 'monospace', cursor: 'text' }}
          title="Click to rename"
        >
          @{domain.domain}
        </span>
      )}
      <span style={{
        fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
        border: `1px solid ${domain.is_active ? 'var(--accent)' : 'var(--border)'}`,
        color: domain.is_active ? 'var(--accent)' : 'var(--muted)',
      }}>
        {domain.is_active ? 'Active' : 'Inactive'}
      </span>
      {editing ? (
        <>
          <button
            onClick={saveRename}
            disabled={updateDomain.isPending}
            style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {updateDomain.isPending ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setValue(domain.domain); setEditing(false); }}
            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => updateDomain.mutate({ collegeId, domainId: domain.id, is_active: !domain.is_active })}
          disabled={updateDomain.isPending}
          style={{
            padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)',
            fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            opacity: updateDomain.isPending ? 0.5 : 1,
          }}
        >
          {domain.is_active ? 'Disable' : 'Enable'}
        </button>
      )}
    </div>
  );
}

function CampusItem({ campus, collegeId }: { campus: CampusResponse; collegeId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(campus.name);
  const updateCampus = useUpdateCampus();

  const saveRename = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === campus.name) { setEditing(false); return; }
    await updateCampus.mutateAsync({ collegeId, campusId: campus.id, name: trimmed });
    setEditing(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setValue(campus.name); setEditing(false); } }}
          style={{
            flex: 1, padding: '4px 8px', background: 'var(--background)',
            border: '1px solid var(--border)', borderRadius: 5,
            fontSize: 13, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => { setValue(campus.name); setEditing(true); }}
          style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', cursor: 'text' }}
          title="Click to rename"
        >
          {campus.name}
        </span>
      )}
      <span style={{
        fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
        border: `1px solid ${campus.is_active ? 'var(--accent)' : 'var(--border)'}`,
        color: campus.is_active ? 'var(--accent)' : 'var(--muted)',
      }}>
        {campus.is_active ? 'Active' : 'Inactive'}
      </span>
      {editing ? (
        <>
          <button
            onClick={saveRename}
            disabled={updateCampus.isPending}
            style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {updateCampus.isPending ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setValue(campus.name); setEditing(false); }}
            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => updateCampus.mutate({ collegeId, campusId: campus.id, is_active: !campus.is_active })}
          disabled={updateCampus.isPending}
          style={{
            padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)',
            fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            opacity: updateCampus.isPending ? 0.5 : 1,
          }}
        >
          {campus.is_active ? 'Disable' : 'Enable'}
        </button>
      )}
    </div>
  );
}

export default function CollegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: colleges = [], isLoading: collegesLoading } = useAdminColleges();
  const { data: domains = [], isLoading: domainsLoading } = useAdminDomains(id);
  const { data: campuses = [], isLoading: campusesLoading } = useAdminCampuses(id);
  const updateCollege = useUpdateCollege();
  const createDomain = useCreateDomain();
  const createCampus = useCreateCampus();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showAddCampus, setShowAddCampus] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [campusError, setCampusError] = useState('');

  if (meLoading) return null;
  if (!me?.is_admin) {
    router.replace('/feed');
    return null;
  }

  const college = colleges.find(c => c.id === id);
  const isLoading = collegesLoading || domainsLoading || campusesLoading;

  if (!isLoading && !college) {
    return (
      <ContentShell>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>College not found.</div>
      </ContentShell>
    );
  }

  async function saveName() {
    if (!nameValue.trim() || !college) return;
    await updateCollege.mutateAsync({ id, name: nameValue.trim() });
    setEditingName(false);
  }

  async function handleAddDomain(domain: string) {
    setDomainError('');
    try {
      await createDomain.mutateAsync({ collegeId: id, domain });
      setShowAddDomain(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setDomainError(msg.includes('409') || msg.includes('already') ? 'Domain already registered' : 'Failed to add domain');
    }
  }

  async function handleAddCampus(name: string) {
    setCampusError('');
    try {
      await createCampus.mutateAsync({ collegeId: id, name });
      setShowAddCampus(false);
    } catch {
      setCampusError('Failed to add campus');
    }
  }

  return (
    <ContentShell>
      <button
        onClick={() => router.push('/admin')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: 0, marginBottom: 20, fontFamily: 'inherit',
        }}
      >
        ← Colleges
      </button>

      {college && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8, flex: 1, marginRight: 12 }}>
                <input
                  autoFocus
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  style={{
                    flex: 1, padding: '6px 10px', background: 'var(--card)',
                    border: '1px solid var(--border)', borderRadius: 7,
                    fontSize: 18, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  onClick={saveName}
                  disabled={updateCollege.isPending}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  style={{
                    padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>
                  {college.name}
                </h1>
                <button
                  onClick={() => { setNameValue(college.name); setEditingName(true); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: 13, padding: '2px 6px', fontFamily: 'inherit',
                  }}
                >
                  Edit
                </button>
              </div>
            )}
            <button
              onClick={() => updateCollege.mutate({ id, is_active: !college.is_active })}
              disabled={updateCollege.isPending}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
              border: `1px solid ${college.is_active ? 'var(--accent)' : 'var(--border)'}`,
              color: college.is_active ? 'var(--accent)' : 'var(--muted)',
            }}>
              {college.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

      <SectionHeader title={`Allowed Domains (${domains.length})`} onAdd={() => setShowAddDomain(v => !v)} />
      {showAddDomain && (
        <AddForm
          placeholder="e.g. iitb.ac.in"
          onSave={handleAddDomain}
          onCancel={() => { setShowAddDomain(false); setDomainError(''); }}
          isPending={createDomain.isPending}
          error={domainError}
        />
      )}
      {domainsLoading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
      {!domainsLoading && domains.length === 0 && !showAddDomain && (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No domains yet.</div>
      )}
      <div>
        {domains.map(d => <DomainItem key={d.id} domain={d} collegeId={id} />)}
      </div>

      <SectionHeader title={`Campuses (${campuses.length})`} onAdd={() => setShowAddCampus(v => !v)} />
      {showAddCampus && (
        <AddForm
          placeholder="Campus name"
          onSave={handleAddCampus}
          onCancel={() => { setShowAddCampus(false); setCampusError(''); }}
          isPending={createCampus.isPending}
          error={campusError}
        />
      )}
      {campusesLoading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
      {!campusesLoading && campuses.length === 0 && !showAddCampus && (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No campuses yet.</div>
      )}
      <div>
        {campuses.map(c => <CampusItem key={c.id} campus={c} collegeId={id} />)}
      </div>
    </ContentShell>
  );
}

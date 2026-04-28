# Global Communities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any user to create campus-agnostic global communities with a 500-member cap, surfaced in a dedicated "Global" tab on the frontend.

**Architecture:** Make `campus_id` nullable on the `communities` table. Global communities are created with `campus_id = NULL`. Backend enforces separate caps (200 campus / 500 global) using constants. Frontend filters by `is_global` flag client-side.

**Tech Stack:** Supabase (PostgreSQL), Express 5 + TypeScript, Jest (backend tests), Next.js 16 + React 19

---

### Task 1: DB Migration — make `campus_id` nullable

**Files:**
- Create: `peerly-backend/supabase/migrations/20260428_communities_campus_id_nullable.sql`

- [ ] **Step 1: Create migration file**

```sql
-- peerly-backend/supabase/migrations/20260428_communities_campus_id_nullable.sql
ALTER TABLE communities ALTER COLUMN campus_id DROP NOT NULL;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste and run:
```sql
ALTER TABLE communities ALTER COLUMN campus_id DROP NOT NULL;
```

Expected: `ALTER TABLE` with no errors.

- [ ] **Step 3: Verify**

Run in SQL Editor:
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'communities' AND column_name = 'campus_id';
```

Expected: `is_nullable = YES`

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/supabase/migrations/20260428_communities_campus_id_nullable.sql
git commit -m "db: make communities.campus_id nullable for global communities"
```

---

### Task 2: Backend — update `CommunityResponse` type

**Files:**
- Modify: `peerly-backend/src/modules/communities/communities.types.ts`

- [ ] **Step 1: Change `campus_id` to `string | null` in `CommunityResponse`**

In `peerly-backend/src/modules/communities/communities.types.ts`, find:
```ts
export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: CommunityRole | null;
}
```

Replace with:
```ts
export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string | null;
  member_count: number;
  created_at: string;
  user_role: CommunityRole | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd peerly-backend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add peerly-backend/src/modules/communities/communities.types.ts
git commit -m "feat(communities): campus_id nullable in CommunityResponse type"
```

---

### Task 3: Backend — cap constants + `createCommunity` fix

**Files:**
- Modify: `peerly-backend/src/modules/communities/communities.service.ts`

- [ ] **Step 1: Add cap constants at top of service file**

In `peerly-backend/src/modules/communities/communities.service.ts`, after the imports and before `ROLE_RANK`, add:

```ts
const CAMPUS_CAP = 200;
const GLOBAL_CAP = 500;
```

- [ ] **Step 2: Fix `createCommunity` to pass `null` campus_id for global communities**

Find the insert in `createCommunity` (line ~72):
```ts
.insert({ ...input, campus_id: campusId, created_by: userId, member_count: 1 })
```

Replace with:
```ts
.insert({ ...input, campus_id: input.is_global ? null : campusId, created_by: userId, member_count: 1 })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd peerly-backend && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/src/modules/communities/communities.service.ts
git commit -m "feat(communities): set campus_id=null when creating global community"
```

---

### Task 4: Backend — `joinCommunity` cap enforcement

**Files:**
- Modify: `peerly-backend/src/modules/communities/communities.service.ts`
- Modify: `peerly-backend/src/__tests__/communities.service.test.ts`

- [ ] **Step 1: Write failing tests for global cap**

In `peerly-backend/src/__tests__/communities.service.test.ts`, add inside the `describe('joinCommunity', ...)` block after the existing tests:

```ts
it('throws 403 when global community member_count >= 500', async () => {
  jest.resetModules();
  const { joinCommunity } = await import('../modules/communities/communities.service.js');
  mockFrom.mockImplementation((table: string) => {
    if (table === 'communities') return chain({ single: () => Promise.resolve({ data: { member_count: 500, is_global: true }, error: null }) });
    if (table === 'community_members') return chain({ single: () => Promise.resolve({ data: null, error: null }) });
    return chain();
  });

  await expect(joinCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 403, message: 'Community is full' });
});

it('does not throw when global community member_count is 499', async () => {
  jest.resetModules();
  const { joinCommunity } = await import('../modules/communities/communities.service.js');
  let insertCalled = false;
  mockFrom.mockImplementation((table: string) => {
    if (table === 'communities') {
      return chain({
        single: () => Promise.resolve({ data: { member_count: 499, is_global: true }, error: null }),
        update: () => chain({ eq: () => Promise.resolve({ error: null }) }),
      });
    }
    if (table === 'community_members') {
      return chain({
        single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
        insert: () => { insertCalled = true; return Promise.resolve({ error: null }); },
      });
    }
    return chain();
  });

  await joinCommunity('comm-1', 'user-1');
  expect(insertCalled).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd peerly-backend && npx jest communities.service --no-coverage 2>&1 | tail -20
```

Expected: new tests FAIL (joinCommunity still uses hardcoded 200).

- [ ] **Step 3: Update `joinCommunity` to use correct cap**

Find the select in `joinCommunity` (around line 112):
```ts
const { data: community, error: fetchErr } = await supabaseAdmin
  .from('communities')
  .select('member_count')
  .eq('id', communityId)
  .single();

if (fetchErr || !community) throw new AppError(404, 'Community not found');
if (community.member_count >= 200) throw new AppError(403, 'Community is full');
```

Replace with:
```ts
const { data: community, error: fetchErr } = await supabaseAdmin
  .from('communities')
  .select('member_count, is_global')
  .eq('id', communityId)
  .single();

if (fetchErr || !community) throw new AppError(404, 'Community not found');
const cap = community.is_global ? GLOBAL_CAP : CAMPUS_CAP;
if (community.member_count >= cap) throw new AppError(403, 'Community is full');
```

- [ ] **Step 4: Run all communities tests**

```bash
cd peerly-backend && npx jest communities.service --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add peerly-backend/src/modules/communities/communities.service.ts \
        peerly-backend/src/__tests__/communities.service.test.ts
git commit -m "feat(communities): enforce separate caps — campus 200, global 500"
```

---

### Task 5: Frontend — update `CommunityResponse` type

**Files:**
- Modify: `peerly-frontend/lib/hooks/useCommunities.ts`

- [ ] **Step 1: Change `campus_id` to `string | null`**

In `peerly-frontend/lib/hooks/useCommunities.ts`, find:
```ts
export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: 'owner' | 'admin' | 'moderator' | 'member' | null;
}
```

Replace with:
```ts
export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string | null;
  member_count: number;
  created_at: string;
  user_role: 'owner' | 'admin' | 'moderator' | 'member' | null;
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd peerly-frontend && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add peerly-frontend/lib/hooks/useCommunities.ts
git commit -m "feat(communities): campus_id nullable in frontend CommunityResponse type"
```

---

### Task 6: Frontend — scope tabs + global checkbox in create form

**Files:**
- Modify: `peerly-frontend/app/communities/page.tsx`

- [ ] **Step 1: Add `scopeTab` state and `newIsGlobal` state, replace `activeTab`**

In `peerly-frontend/app/communities/page.tsx`, find the existing state declarations at the top of `CommunitiesPage`:
```ts
const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');
```

Replace with:
```ts
const [scopeTab, setScopeTab] = useState<'college' | 'global' | 'all'>('all');
const [newIsGlobal, setNewIsGlobal] = useState(false);
```

- [ ] **Step 2: Update the `displayed` filtering logic**

Find:
```ts
const joined = all.filter(c => c.user_role !== null);
const displayed = (activeTab === 'joined' ? joined : all).filter(c =>
  activeCat === 'All' || c.category === activeCat
);
```

Replace with:
```ts
const scopeFiltered =
  scopeTab === 'college' ? all.filter(c => !c.is_global) :
  scopeTab === 'global'  ? all.filter(c => c.is_global) :
  all;
const displayed = scopeFiltered.filter(c =>
  activeCat === 'All' || c.category === activeCat
);
```

- [ ] **Step 3: Replace the tab bar JSX**

Find the tab bar JSX (the `<div>` with `borderBottom` and the two tab buttons for `discover`/`joined`):
```tsx
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
```

Replace with:
```tsx
<div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
  {([['all', 'All'], ['college', 'My College'], ['global', 'Global']] as const).map(([id, label]) => (
    <button key={id} onClick={() => setScopeTab(id)} style={{
      padding: '10px 0', marginRight: 24, background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: scopeTab === id ? 600 : 400,
      color: scopeTab === id ? 'var(--foreground)' : 'var(--muted)',
      borderBottom: scopeTab === id ? '2px solid var(--foreground)' : '2px solid transparent', marginBottom: -1,
    }}>
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Add `is_global` checkbox to the create form and wire it to `handleCreate`**

In the create form, find the category buttons row:
```tsx
<div style={{ display: 'flex', gap: 8 }}>
  {(['Technical', 'Cultural', 'Sports'] as const).map(cat => (
    ...
  ))}
</div>
```

Add this block immediately after that `</div>`:
```tsx
<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
  <input
    type="checkbox"
    checked={newIsGlobal}
    onChange={e => setNewIsGlobal(e.target.checked)}
    style={{ cursor: 'pointer' }}
  />
  Make this a global community (visible to all campuses, max 500 members)
</label>
```

- [ ] **Step 5: Pass `is_global` in `handleCreate`**

Find in `handleCreate`:
```ts
const c = await createCommunity.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined, category: newCat });
setShowCreate(false);
setNewName(''); setNewDesc(''); setNewCat('Technical');
```

Replace with:
```ts
const c = await createCommunity.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined, category: newCat, is_global: newIsGlobal });
setShowCreate(false);
setNewName(''); setNewDesc(''); setNewCat('Technical'); setNewIsGlobal(false);
```

- [ ] **Step 6: Add "Global" badge to community list items**

In the community list item JSX, find the name + category badge row:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{c.name}</span>
  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>{c.category}</span>
</div>
```

Replace with:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{c.name}</span>
  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>{c.category}</span>
  {c.is_global && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>Global</span>}
</div>
```

- [ ] **Step 7: Start dev server and manually verify**

```bash
cd peerly-frontend && npm run dev
```

Check:
1. Communities page shows 3 tabs: All | My College | Global
2. "All" tab shows all communities
3. "My College" tab shows only campus communities (`is_global === false`)
4. "Global" tab shows only global communities (`is_global === true`)
5. Create form has "Make this a global community" checkbox
6. Creating with checkbox checked → community appears in "Global" tab
7. Global communities show "Global" badge next to category

- [ ] **Step 8: Commit**

```bash
git add peerly-frontend/app/communities/page.tsx
git commit -m "feat(communities): add My College/Global/All tabs and global community creation"
```

---

### Task 7: Final build verification

- [ ] **Step 1: Backend build**

```bash
cd peerly-backend && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 2: Frontend build**

```bash
cd peerly-frontend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Run full backend test suite**

```bash
cd peerly-backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

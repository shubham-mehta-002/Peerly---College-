import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function chain(overrides: Record<string, unknown> = {}): unknown {
  const c: Record<string, unknown> = {
    select: () => c, eq: () => c, or: () => c, ilike: () => c,
    order: () => c, single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c, update: () => c, delete: () => c,
    ...overrides,
  };
  return c;
}

describe('joinCommunity', () => {
  it('throws 403 when member_count >= 200', async () => {
    const { joinCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'communities') return chain({ single: () => Promise.resolve({ data: { member_count: 200 }, error: null }) });
      if (table === 'community_members') return chain({ single: () => Promise.resolve({ data: null, error: null }) });
      return chain();
    });

    await expect(joinCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 403, message: 'Community is full' });
  });

  it('throws 409 when already a member', async () => {
    const { joinCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'communities') return chain({ single: () => Promise.resolve({ data: { member_count: 5 }, error: null }) });
      if (table === 'community_members') return chain({ single: () => Promise.resolve({ data: { role: 'member' }, error: null }) });
      return chain();
    });

    await expect(joinCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('leaveCommunity', () => {
  it('throws 403 when user is owner', async () => {
    const { leaveCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: { role: 'owner' }, error: null }) })
    );

    await expect(leaveCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 403, message: 'Transfer ownership before leaving' });
  });
});

describe('kickMember', () => {
  it('throws 403 when kicker rank <= target rank', async () => {
    const { kickMember } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation(() =>
      chain({
        single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
      })
    );

    await expect(kickMember('comm-1', 'kicker', 'target')).rejects.toMatchObject({ status: 403 });
  });
});

describe('updateMemberRole', () => {
  it('throws 403 when non-owner tries to assign admin', async () => {
    const { updateMemberRole } = await import('../modules/communities/communities.service.js');
    let call = 0;
    mockFrom.mockImplementation(() =>
      chain({
        single: () => {
          call++;
          const role = call === 1 ? 'admin' : 'member';
          return Promise.resolve({ data: { role }, error: null });
        },
      })
    );

    await expect(updateMemberRole('comm-1', 'updater', 'target', { role: 'admin' })).rejects.toMatchObject({ status: 403, message: 'Only owner can assign admin' });
  });
});

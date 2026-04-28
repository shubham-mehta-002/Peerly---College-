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
    select: () => c, eq: () => c, in: () => c, gt: () => c, order: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c, update: () => c, delete: () => c,
    range: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

describe('createReport', () => {
  it('throws 404 when post not found', async () => {
    const { createReport } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) })
    );
    await expect(createReport('post-1', 'user-1', 'spam')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 when already reported', async () => {
    const { createReport } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') return chain({ single: () => Promise.resolve({ data: { id: 'post-1', report_count: 2 }, error: null }) });
      if (table === 'post_reports') return chain({ insert: () => Promise.resolve({ error: { code: '23505' } }) });
      return chain();
    });
    await expect(createReport('post-1', 'user-1', 'spam')).rejects.toMatchObject({ status: 409 });
  });

  it('inserts report and increments report_count', async () => {
    const { createReport } = await import('../modules/reports/reports.service.js');
    let updateCalled = false;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') return chain({
        single: () => Promise.resolve({ data: { id: 'post-1', report_count: 0 }, error: null }),
        update: () => chain({ eq: () => { updateCalled = true; return Promise.resolve({ error: null }); } }),
      });
      if (table === 'post_reports') return chain({ insert: () => Promise.resolve({ error: null }) });
      return chain();
    });
    await createReport('post-1', 'user-1', 'spam');
    expect(updateCalled).toBe(true);
  });
});

describe('getAdminReports', () => {
  it('returns empty array when no posts with reports', async () => {
    const { getAdminReports } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') return chain({
        range: () => Promise.resolve({ data: [], error: null })
      });
      if (table === 'post_reports') return chain({
        select: () => Promise.resolve({ data: [], error: null })
      });
      return chain();
    });
    const result = await getAdminReports({ page: 1, limit: 20 });
    expect(result).toEqual([]);
  });
});

describe('hidePost', () => {
  it('throws 404 when post not found', async () => {
    const { hidePost } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) })
    );
    await expect(hidePost('post-1')).rejects.toMatchObject({ status: 404 });
  });

  it('sets is_hidden to true', async () => {
    const { hidePost } = await import('../modules/reports/reports.service.js');
    let hideCalled = false;
    mockFrom.mockImplementation(() =>
      chain({
        update: () => chain({
          select: () => chain({
            single: () => { hideCalled = true; return Promise.resolve({ data: { id: 'post-1' }, error: null }); }
          })
        })
      })
    );
    await hidePost('post-1');
    expect(hideCalled).toBe(true);
  });
});

import { computeHeatScore, maskAuthor } from '../modules/posts/posts.service.js';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function chain(overrides: Record<string, any> = {}): any {
  const c: any = {
    select: () => c,
    eq: () => c,
    in: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    update: () => c,
    delete: () => c,
    order: () => c,
    range: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

describe('computeHeatScore', () => {
  it('returns 0 when all inputs are 0', () => {
    expect(computeHeatScore(0, 0, 0, new Date().toISOString())).toBe(0);
  });

  it('increases with more upvotes', () => {
    const now = new Date().toISOString();
    expect(computeHeatScore(10, 0, 0, now)).toBeGreaterThan(computeHeatScore(1, 0, 0, now));
  });

  it('decreases for older posts', () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(computeHeatScore(5, 0, 0, recent)).toBeGreaterThan(computeHeatScore(5, 0, 0, old));
  });

  it('never returns negative', () => {
    expect(computeHeatScore(0, 100, 0, new Date().toISOString())).toBeGreaterThanOrEqual(0);
  });
});

describe('maskAuthor', () => {
  const authorId = 'user-1';
  const viewerId = 'user-2';

  it('returns real username when not anonymous', () => {
    const result = maskAuthor(authorId, false, viewerId, 'campus', 'IIT Bombay', 'alice', 'Alice Smith', 'avatar.jpg');
    expect(result).toEqual({ username: 'alice', name: 'Alice Smith', avatar_url: 'avatar.jpg' });
  });

  it('returns "Anonymous Peer" on campus feed', () => {
    const result = maskAuthor(authorId, true, viewerId, 'campus', 'IIT Bombay', 'alice', 'Alice Smith', null);
    expect(result).toEqual({ username: 'Anonymous Peer', name: null, avatar_url: null });
  });

  it('returns college name on global feed', () => {
    const result = maskAuthor(authorId, true, viewerId, 'global', 'IIT Bombay', 'alice', 'Alice Smith', null);
    expect(result).toEqual({ username: 'Anonymous @ IIT Bombay', name: null, avatar_url: null });
  });

  it('returns real username when viewer is the author even if anonymous', () => {
    const result = maskAuthor(authorId, true, authorId, 'global', 'IIT Bombay', 'alice', 'Alice Smith', null);
    expect(result).toEqual({ username: 'alice', name: 'Alice Smith', avatar_url: null });
  });
});

describe('castVote', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if post not found', async () => {
    const { castVote } = await import('../modules/posts/posts.service.js');
    mockFrom.mockReturnValue(chain({ single: () => Promise.resolve({ data: null, error: null }) }));
    await expect(castVote('p1', 'u1', 'up')).rejects.toMatchObject({ status: 404 });
  });

  it('no-ops when removing a vote that does not exist', async () => {
    const { castVote } = await import('../modules/posts/posts.service.js');
    const postData = { id: 'p1', upvotes: 5, downvotes: 1, comment_count: 2, created_at: new Date().toISOString() };
    let updateCalled = false;

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: postData, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: null, error: null }) }))
      .mockReturnValue({ ...chain(), update: () => { updateCalled = true; return chain(); } });

    await castVote('p1', 'u1', null);
    expect(updateCalled).toBe(false);
  });

  it('no-ops when casting same vote type', async () => {
    const { castVote } = await import('../modules/posts/posts.service.js');
    const postData = { id: 'p1', upvotes: 5, downvotes: 1, comment_count: 2, created_at: new Date().toISOString() };
    let updateCalled = false;

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: postData, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { vote_type: 'up' }, error: null }) }))
      .mockReturnValue({ ...chain(), update: () => { updateCalled = true; return chain(); } });

    await castVote('p1', 'u1', 'up');
    expect(updateCalled).toBe(false);
  });
});

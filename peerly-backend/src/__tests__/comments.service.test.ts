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
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    update: () => c,
    delete: () => c,
    order: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

const now = new Date().toISOString();

describe('addComment', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if post not found', async () => {
    const { addComment } = await import('../modules/comments/comments.service.js');
    mockFrom.mockReturnValue(chain());
    await expect(addComment('p1', 'u1', { content: 'hello' })).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 if parent_id does not belong to post', async () => {
    const { addComment } = await import('../modules/comments/comments.service.js');
    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { depth: 0, post_id: 'other-post' }, error: null }) }));

    await expect(addComment('p1', 'u1', { content: 'reply', parent_id: 'c1' })).rejects.toMatchObject({ status: 400, message: 'Invalid parent comment' });
  });

  it('sets depth = parent.depth + 1 for replies', async () => {
    const { addComment } = await import('../modules/comments/comments.service.js');
    let capturedDepth = -1;
    const fakeComment = { id: 'c2', parent_id: 'c1', depth: 2, content: 'reply', created_at: now, author: { username: 'alice', avatar_url: null } };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { depth: 1, post_id: 'p1' }, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          capturedDepth = data.depth;
          return { select: () => ({ single: () => Promise.resolve({ data: fakeComment, error: null }) }) };
        },
      })
      .mockReturnValue(chain({ update: () => chain() }));

    await addComment('p1', 'u1', { content: 'reply', parent_id: 'c1' });
    expect(capturedDepth).toBe(2);
  });

  it('sets depth = 0 for top-level comments', async () => {
    const { addComment } = await import('../modules/comments/comments.service.js');
    let capturedDepth = -1;
    const fakeComment = { id: 'c1', parent_id: null, depth: 0, content: 'hello', created_at: now, author: { username: 'alice', avatar_url: null } };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          capturedDepth = data.depth;
          return { select: () => ({ single: () => Promise.resolve({ data: fakeComment, error: null }) }) };
        },
      })
      .mockReturnValue(chain({ update: () => chain() }));

    await addComment('p1', 'u1', { content: 'hello' });
    expect(capturedDepth).toBe(0);
  });
});

describe('deleteComment', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if comment not found', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service.js');
    mockFrom.mockReturnValue(chain());
    await expect(deleteComment('c1', 'p1', 'u1', false)).rejects.toMatchObject({ status: 404 });
  });

  it('throws 403 if not owner and not admin', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service.js');
    mockFrom.mockReturnValue(chain({ single: () => Promise.resolve({ data: { author_id: 'other', post_id: 'p1' }, error: null }) }));
    await expect(deleteComment('c1', 'p1', 'u1', false)).rejects.toMatchObject({ status: 403 });
  });

  it('allows admin to delete any comment', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service.js');
    const postData = { upvotes: 0, downvotes: 0, comment_count: 2, created_at: now };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { author_id: 'other', post_id: 'p1' }, error: null }) }))
      .mockReturnValueOnce(chain({ delete: () => chain() }))
      .mockReturnValue(chain({
        single: () => Promise.resolve({ data: postData, error: null }),
        update: () => chain(),
      }));

    await expect(deleteComment('c1', 'p1', 'admin', true)).resolves.toBeUndefined();
  });
});

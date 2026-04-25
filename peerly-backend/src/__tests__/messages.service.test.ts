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
    select: () => c, eq: () => c, lt: () => c,
    order: () => c, limit: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    ...overrides,
  };
  return c;
}

describe('getHistory', () => {
  it('fetches without cursor when before is undefined', async () => {
    const { getHistory } = await import('../modules/messages/messages.service.js');

    const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain({ limit: limitMock }));

    await getHistory('comm-1');

    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('fetches cursor timestamp then filters with lt when before is provided', async () => {
    const { getHistory } = await import('../modules/messages/messages.service.js');

    const ltMock = jest.fn().mockReturnValue(chain({ limit: jest.fn().mockResolvedValue({ data: [], error: null }) }));
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) {
        return chain({ single: () => Promise.resolve({ data: { created_at: '2026-04-19T10:00:00Z' }, error: null }) });
      }
      return chain({ lt: ltMock });
    });

    await getHistory('comm-1', 'msg-uuid-before');

    expect(ltMock).toHaveBeenCalledWith('created_at', '2026-04-19T10:00:00Z');
  });
});

import { supabaseAdmin } from '../lib/supabase';
import { verifyToken } from '../lib/jwt';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../lib/jwt', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;
const mockVerify = verifyToken as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
});

function chain(overrides: Record<string, unknown> = {}): unknown {
  const c: Record<string, unknown> = {
    select: () => c, eq: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    ...overrides,
  };
  return c;
}

function makeSocket(token?: string) {
  return { handshake: { auth: { token } }, data: {} } as unknown as import('socket.io').Socket;
}

describe('gatewayAuth', () => {
  it('calls next(Error) when token is missing', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    const next = jest.fn();
    await gatewayAuth(makeSocket(undefined), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('calls next(Error) when verifyToken throws', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    mockVerify.mockImplementation(() => { throw new Error('invalid sig'); });
    const next = jest.fn();
    await gatewayAuth(makeSocket('bad-token'), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('sets socket.data.user and calls next() on valid token', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    mockVerify.mockReturnValue({ userId: 'u1', isAdmin: false });
    mockFrom.mockReturnValue(chain({
      single: () => Promise.resolve({ data: { id: 'u1', username: 'alice', campus_id: 'c1' }, error: null }),
    }));
    const socket = makeSocket('valid-token');
    const next = jest.fn();
    await gatewayAuth(socket, next);
    expect(socket.data.user).toMatchObject({ userId: 'u1', username: 'alice' });
    expect(next).toHaveBeenCalledWith();
  });
});

import { extractDomain, validateDomain, resetPassword, verifyEmailOTP } from '../modules/auth/auth.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  config: { FRONTEND_URL: 'http://localhost:3000' },
}));

jest.mock('../lib/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendOTPEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => chain,
    limit: () => chain,
  };
  return chain;
}

describe('extractDomain', () => {
  it('extracts domain from email', () => {
    expect(extractDomain('user@iitb.ac.in')).toBe('iitb.ac.in');
  });

  it('lowercases the domain', () => {
    expect(extractDomain('user@IITB.AC.IN')).toBe('iitb.ac.in');
  });
});

describe('validateDomain', () => {
  it('throws 403 if domain not found', async () => {
    mockFrom.mockReturnValue(mockChain({ data: null, error: null }));

    await expect(validateDomain('unknown.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Domain not recognized',
    });
  });

  it('throws 403 if domain is inactive', async () => {
    mockFrom.mockReturnValue(
      mockChain({
        data: {
          id: '1',
          college_id: 'c1',
          is_active: false,
          colleges: { is_active: true },
        },
        error: null,
      })
    );

    await expect(validateDomain('inactive.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Your institution is not currently active',
    });
  });

  it('throws 403 if college is inactive', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: false },
          },
          error: null,
        })
      );

    await expect(validateDomain('inactive-college.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Your institution is not currently active',
    });
  });

  it('throws 403 if no active campus', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: true },
          },
          error: null,
        })
      )
      .mockReturnValueOnce(mockChain({ data: null, error: null }));

    await expect(validateDomain('nocampus.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'No active campus available for your institution',
    });
  });

  it('returns collegeId when all checks pass', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: true },
          },
          error: null,
        })
      )
      .mockReturnValueOnce(mockChain({ data: { id: 'campus1' }, error: null }));

    const result = await validateDomain('valid.ac.in');
    expect(result).toEqual({ collegeId: 'c1' });
  });
});

describe('resetPassword', () => {
  it('throws 400 when token not found', async () => {
    mockFrom.mockReturnValue(
      mockChain({ data: null, error: { code: 'PGRST116' } })
    );
    await expect(resetPassword('bad-token', 'newpass123')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid or expired reset token',
    });
  });

  it('throws 400 when token is already used', async () => {
    mockFrom.mockReturnValue(
      mockChain({
        data: { id: 't1', user_id: 'u1', expires_at: new Date(Date.now() + 3600000).toISOString(), used: true },
        error: null,
      })
    );
    await expect(resetPassword('some-token', 'newpass123')).rejects.toMatchObject({
      status: 400,
      message: 'Reset token already used',
    });
  });

  it('throws 400 when token is expired', async () => {
    mockFrom.mockReturnValue(
      mockChain({
        data: { id: 't1', user_id: 'u1', expires_at: new Date(Date.now() - 1000).toISOString(), used: false },
        error: null,
      })
    );
    await expect(resetPassword('some-token', 'newpass123')).rejects.toMatchObject({
      status: 400,
      message: 'Reset token expired',
    });
  });
});

describe('verifyEmailOTP', () => {
  it('throws 409 when email already verified', async () => {
    mockFrom.mockReturnValue(
      mockChain({ data: { id: 'u1', is_email_verified: true }, error: null })
    );
    await expect(verifyEmailOTP('user@test.ac.in', '123456')).rejects.toMatchObject({
      status: 409,
      message: 'Email already verified',
    });
  });

  it('throws 400 when OTP is invalid (not found)', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({ data: { id: 'u1', is_email_verified: false }, error: null })
      )
      .mockReturnValueOnce(
        mockChain({ data: null, error: { code: 'PGRST116' } })
      );
    await expect(verifyEmailOTP('user@test.ac.in', '000000')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid OTP',
    });
  });

  it('throws 400 when OTP is expired', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({ data: { id: 'u1', is_email_verified: false }, error: null })
      )
      .mockReturnValueOnce(
        mockChain({
          data: { id: 'otp1', expires_at: new Date(Date.now() - 1000).toISOString(), used: false },
          error: null,
        })
      );
    await expect(verifyEmailOTP('user@test.ac.in', '123456')).rejects.toMatchObject({
      status: 400,
      message: 'OTP expired',
    });
  });
});

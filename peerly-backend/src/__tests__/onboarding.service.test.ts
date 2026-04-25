import { getCampusesForUser, completeOnboarding } from '../modules/onboarding/onboarding.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../lib/jwt', () => ({
  signToken: jest.fn(() => 'mock.jwt.token'),
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function single(data: any) {
  return { single: () => Promise.resolve({ data, error: data ? null : new Error('not found') }) };
}

function orderResult(data: any[]) {
  return { order: () => Promise.resolve({ data, error: null }) };
}

describe('getCampusesForUser', () => {
  it('throws 403 if domain not recognized', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => single(null) }) }),
    });

    await expect(getCampusesForUser('user@unknown.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Domain not recognized',
    });
  });

  it('returns active campuses for valid domain', async () => {
    const fakeCampuses = [
      { id: 'camp1', name: 'Main Campus', college_id: 'c1' },
    ];

    mockFrom
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ eq: () => single({ college_id: 'c1' }) }) }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({ eq: () => orderResult(fakeCampuses) }),
        }),
      });

    const result = await getCampusesForUser('user@valid.ac.in');
    expect(result).toEqual(fakeCampuses);
  });
});

describe('completeOnboarding', () => {
  it('throws 400 if onboarding already completed', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => single({ onboarding_completed: true }) }),
    });

    await expect(
      completeOnboarding('u1', 'user@valid.ac.in', false, {
        name: 'Alice',
        username: 'alice',
        campus_id: 'camp1',
      })
    ).rejects.toMatchObject({ status: 400, message: 'Onboarding already completed' });
  });

  it('returns token and profile on success', async () => {
    const updatedProfile = {
      id: 'u1', name: 'Alice', username: 'alice', campus_id: 'camp1', onboarding_completed: true,
    };

    mockFrom
      .mockReturnValueOnce({ select: () => ({ eq: () => single({ onboarding_completed: false }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => single({ college_id: 'c1' }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => single({ id: 'camp1' }) }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => single(null) }) })
      .mockReturnValueOnce({
        update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: updatedProfile, error: null }) }) }) }),
      });

    const result = await completeOnboarding('u1', 'user@valid.ac.in', false, {
      name: 'Alice',
      username: 'alice',
      campus_id: 'camp1',
    });

    expect(result.token).toBe('mock.jwt.token');
    expect(result.profile).toEqual(updatedProfile);
  });
});

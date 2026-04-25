import { createCollege, createDomain, updateDomain, createCampus } from '../modules/admin/admin.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function mockChain(overrides: Partial<Record<string, any>> = {}) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => chain,
    update: () => chain,
    order: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return chain;
}

describe('createCollege', () => {
  it('returns created college', async () => {
    const fakeCollege = { id: 'c1', name: 'IIT Bombay', is_active: true };
    mockFrom.mockReturnValue({
      ...mockChain(),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: fakeCollege, error: null }) }),
      }),
    });

    const result = await createCollege('IIT Bombay');
    expect(result).toEqual(fakeCollege);
  });

  it('throws 500 on DB error', async () => {
    mockFrom.mockReturnValue({
      ...mockChain(),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('db error') }) }),
      }),
    });

    await expect(createCollege('IIT Bombay')).rejects.toMatchObject({ status: 500 });
  });
});

describe('createDomain', () => {
  it('throws 409 if domain already exists', async () => {
    mockFrom.mockReturnValue(
      mockChain({ single: () => Promise.resolve({ data: { id: 'd1' }, error: null }) })
    );

    await expect(createDomain('c1', 'iitb.ac.in')).rejects.toMatchObject({
      status: 409,
      message: 'Domain already registered',
    });
  });

  it('normalizes domain to lowercase', async () => {
    let insertedDomain = '';
    mockFrom
      .mockReturnValueOnce(mockChain({ single: () => Promise.resolve({ data: null, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          insertedDomain = data.domain;
          return {
            select: () => ({ single: () => Promise.resolve({ data: { id: 'd1', domain: data.domain }, error: null }) }),
          };
        },
      });

    await createDomain('c1', 'IITB.AC.IN');
    expect(insertedDomain).toBe('iitb.ac.in');
  });
});

describe('updateDomain', () => {
  it('throws 404 if domain not found for this college', async () => {
    mockFrom.mockReturnValue(
      mockChain({ single: () => Promise.resolve({ data: null, error: new Error('not found') }) })
    );

    await expect(updateDomain('c1', 'd1', { is_active: false })).rejects.toMatchObject({ status: 404 });
  });
});

describe('createCampus', () => {
  it('returns created campus', async () => {
    const fakeCampus = { id: 'camp1', college_id: 'c1', name: 'Main Campus', is_active: true };
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: fakeCampus, error: null }) }),
      }),
    });

    const result = await createCampus('c1', 'Main Campus');
    expect(result).toEqual(fakeCampus);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticatePhonePin } from './service';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';
import * as pinModule from '@/modules/auth/pin';
import * as sessionModule from '@/modules/auth/session';

const { mockUser } = vi.hoisted(() => {
  const mockUser = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  return { mockUser };
});

vi.mock('@/server/db', () => ({
  db: {
    user: mockUser,
  },
}));

vi.mock('@/modules/auth/pin', async (importOriginal) => {
  const actual = await importOriginal<typeof pinModule>();
  return {
    ...actual,
    verifyPin: vi.fn(),
  };
});

vi.mock('@/modules/auth/session', () => ({
  createSessionToken: vi.fn().mockResolvedValue('mock-session-token'),
}));

vi.mock('@/server/env', () => ({
  env: {
    DEMO_LOGIN_PHONE: '+251911000000',
  },
}));

describe('Auth Service: authenticatePhonePin (Task 2.2 Database Lockout)', () => {
  const phone = '+251912345678';
  const pin = '1234';

  const baseUser = {
    id: 'user_123',
    phone,
    pinHash: '$2b$10$validhash12345678901234567890123456789012345678901234',
    failedLoginCount: 0,
    lockedUntil: null,
    stores: [{ id: 'store_123', name: 'Test Store' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('locks account for 15 minutes after 5 consecutive failures', async () => {
    // 4th failure -> increments to 5, triggers lockout
    mockUser.findUnique.mockResolvedValueOnce({
      ...baseUser,
      failedLoginCount: 4,
    });
    vi.mocked(pinModule.verifyPin).mockResolvedValueOnce(false);
    mockUser.update.mockResolvedValueOnce({});

    await expect(authenticatePhonePin(phone, pin)).rejects.toThrowError(
      new AppError('UNAUTHORIZED', 'Invalid phone number or PIN')
    );

    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: expect.any(Date),
      },
    });

    const updateCall = mockUser.update.mock.calls[0][0];
    const lockedUntil = updateCall.data.lockedUntil as Date;
    const diffMs = lockedUntil.getTime() - Date.now();
    // Verify approximately 15 minutes in the future (~900,000 ms)
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
  });

  it('atomically increments failedLoginCount if failures < 5', async () => {
    mockUser.findUnique.mockResolvedValueOnce({
      ...baseUser,
      failedLoginCount: 2,
    });
    vi.mocked(pinModule.verifyPin).mockResolvedValueOnce(false);
    mockUser.update.mockResolvedValueOnce({});

    await expect(authenticatePhonePin(phone, pin)).rejects.toThrowError(
      new AppError('UNAUTHORIZED', 'Invalid phone number or PIN')
    );

    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: {
        failedLoginCount: { increment: 1 },
      },
    });
  });

  it('rejects login during active lockout window with RATE_LIMITED even with correct PIN', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // locked for 10 more minutes
    mockUser.findUnique.mockResolvedValueOnce({
      ...baseUser,
      failedLoginCount: 0,
      lockedUntil,
    });

    let thrownError: unknown;
    try {
      await authenticatePhonePin(phone, pin);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    const appErr = thrownError as AppError;
    expect(appErr.code).toBe('RATE_LIMITED');
    expect(appErr.message).toBe('Too many attempts. Try again later.');
    expect(appErr.retryAfter).toBeGreaterThan(0);
    expect(appErr.retryAfter).toBeLessThanOrEqual(600);

    // CRITICAL: verifyPin and user.update must not be called during active lockout
    expect(pinModule.verifyPin).not.toHaveBeenCalled();
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('resets failedLoginCount and clears lockedUntil on successful login', async () => {
    mockUser.findUnique.mockResolvedValueOnce({
      ...baseUser,
      failedLoginCount: 3,
      lockedUntil: null,
    });
    vi.mocked(pinModule.verifyPin).mockResolvedValueOnce(true);
    mockUser.update.mockResolvedValueOnce({});

    const result = await authenticatePhonePin(phone, pin);

    expect(result.user.id).toBe(baseUser.id);
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  });

  it('exempts demo phone from lockout even with consecutive failures', async () => {
    const demoPhone = '+251911000000';
    mockUser.findUnique.mockResolvedValueOnce({
      ...baseUser,
      phone: demoPhone,
      failedLoginCount: 10,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // even if stale lockedUntil was present
    });
    vi.mocked(pinModule.verifyPin).mockResolvedValueOnce(false);

    await expect(authenticatePhonePin(demoPhone, pin)).rejects.toThrowError(
      new AppError('UNAUTHORIZED', 'Invalid phone number or PIN')
    );

    // Demo phone must never update lockout state in DB
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('runs constant-time dummy verification on unknown phone to prevent timing attacks', async () => {
    mockUser.findUnique.mockResolvedValueOnce(null);

    await expect(authenticatePhonePin('+251999999999', '9999')).rejects.toThrowError(
      new AppError('UNAUTHORIZED', 'Invalid phone number or PIN')
    );

    // Dummy bcrypt verifyPin was called once with constant hash
    expect(pinModule.verifyPin).toHaveBeenCalledTimes(1);
    expect(pinModule.verifyPin).toHaveBeenCalledWith('9999', expect.any(String));
  });
});

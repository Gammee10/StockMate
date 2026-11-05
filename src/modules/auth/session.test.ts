import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from './session';

describe('Auth Domain: JWT Session Management (jose)', () => {
  const dummyPayload = {
    userId: 'user_cuid_123',
    storeId: 'store_cuid_456',
    phone: '+251911000000',
  };

  beforeEach(() => {
    vi.stubEnv(
      'JWT_SECRET',
      'super_secret_test_jwt_key_that_is_at_least_32_characters_long!'
    );
  });

  it('exports session cookie constant', () => {
    expect(SESSION_COOKIE_NAME).toBe('stockmate_session');
  });

  it('signs and verifies a valid JWT session token', async () => {
    const token = await createSessionToken(dummyPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // Header.Payload.Signature

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(dummyPayload.userId);
    expect(verified?.storeId).toBe(dummyPayload.storeId);
    expect(verified?.phone).toBe(dummyPayload.phone);
  });

  it('returns null when verifying a tampered token', async () => {
    const token = await createSessionToken(dummyPayload);
    const tampered = token.slice(0, -6) + 'abc123';

    const result = await verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  it('returns null for empty or garbage tokens', async () => {
    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('invalid.token.string')).toBeNull();
  });
});

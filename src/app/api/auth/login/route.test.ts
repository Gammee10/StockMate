import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Auth API: POST /api/auth/login', () => {
  const validPhone = '0911000000';
  const normalizedPhone = '+251911000000';
  const validPin = '1234';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      'JWT_SECRET',
      'super_secret_test_jwt_key_that_is_at_least_32_characters_long!'
    );
  });

  it('authenticates valid credentials, issues httpOnly session cookie, and returns store metadata', async () => {
    const pinHash = await bcrypt.hash(validPin, 10);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 'user_1',
      phone: normalizedPhone,
      pinHash,
      createdAt: new Date(),
      stores: [
        {
          id: 'store_1',
          name: "Dawit's Kiosk",
          userId: 'user_1',
          createdAt: new Date(),
        },
      ],
    } as never);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: validPhone, pin: validPin }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe('user_1');
    expect(data.user.phone).toBe(normalizedPhone);
    expect(data.store.id).toBe('store_1');
    expect(data.store.name).toBe("Dawit's Kiosk");

    // Verify Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain('stockmate_session=');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Path=/');
  });

  it('returns 401 Unauthorized for incorrect PIN without leaking details', async () => {
    const pinHash = await bcrypt.hash('9999', 10);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 'user_1',
      phone: normalizedPhone,
      pinHash,
      createdAt: new Date(),
      stores: [
        { id: 'store_1', name: "Dawit's Kiosk", userId: 'user_1', createdAt: new Date() },
      ],
    } as never);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: validPhone, pin: '0000' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.message).toBe('Invalid phone number or PIN');
  });

  it('returns 401 Unauthorized for non-existent phone number', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0999999999', pin: '1234' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.message).toBe('Invalid phone number or PIN');
  });

  it('returns 400 Bad Request for malformed inputs', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'bad-phone', pin: 'abc' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

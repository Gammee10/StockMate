import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createSessionToken } from '@/modules/auth/session';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    store: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Auth API: GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      'JWT_SECRET',
      'super_secret_test_jwt_key_that_is_at_least_32_characters_long!'
    );
  });

  it('returns 200 and session data when authenticated cookie is present', async () => {
    vi.mocked(db.store.findUnique).mockResolvedValueOnce({
      id: 'store_1',
      name: "Dawit's Kiosk",
    } as never);

    const token = await createSessionToken({
      userId: 'user_1',
      storeId: 'store_1',
      phone: '+251911000000',
    });

    const request = new Request('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `stockmate_session=${token}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.authenticated).toBe(true);
    expect(data.user.id).toBe('user_1');
    expect(data.store.id).toBe('store_1');
    expect(data.store.name).toBe("Dawit's Kiosk");
  });

  it('returns 401 Unauthorized when session cookie is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/me');

    const response = await GET(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.authenticated).toBe(false);
  });
});

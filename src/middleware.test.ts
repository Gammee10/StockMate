import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware } from './middleware';
import { NextRequest } from 'next/server';
import { createSessionToken } from './modules/auth/session';

describe('Route Protection Middleware', () => {
  beforeEach(() => {
    vi.stubEnv(
      'JWT_SECRET',
      'super_secret_test_jwt_key_that_is_at_least_32_characters_long!'
    );
  });

  it('allows public health probe without authentication', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows public login page without authentication', async () => {
    const req = new NextRequest('http://localhost:3000/login');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated browser requests from / to /login', async () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('returns 401 JSON for unauthenticated protected API routes', async () => {
    const req = new NextRequest('http://localhost:3000/api/catalog/products');
    const res = await middleware(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('passes authenticated requests and injects x-store-id header', async () => {
    const token = await createSessionToken({
      userId: 'user_1',
      storeId: 'store_1',
      phone: '+251911000000',
    });

    const req = new NextRequest('http://localhost:3000/', {
      headers: {
        cookie: `stockmate_session=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects authenticated user away from /login back to /', async () => {
    const token = await createSessionToken({
      userId: 'user_1',
      storeId: 'store_1',
      phone: '+251911000000',
    });

    const req = new NextRequest('http://localhost:3000/login', {
      headers: {
        cookie: `stockmate_session=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });
});

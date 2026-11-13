import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('Auth API: POST /api/auth/logout', () => {
  it('clears the stockmate_session cookie with max-age=0 and returns success', async () => {
    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('stockmate_session=;');
    expect(setCookie).toContain('Max-Age=0');
  });
});

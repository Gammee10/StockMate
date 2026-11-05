import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Health Check API Route (/api/health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and healthy status when database ping succeeds', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();
    expect(response.status).toBe(200);

    const headers = response.headers;
    expect(headers.get('Cache-Control')).toContain('no-store');

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe('number');
    expect(body.checks.database.status).toBe('connected');
    expect(typeof body.checks.database.latencyMs).toBe('number');
  });

  it('returns 503 and unhealthy status when database connection fails', async () => {
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly')
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const headers = response.headers;
    expect(headers.get('Cache-Control')).toContain('no-store');

    const body = await response.json();
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('disconnected');
    expect(body.checks.database.error).toBe('Database unreachable');
  });
});

// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { logError } from '@/server/log';

export const dynamic = 'force-dynamic';

// backend-check-ignore entry-no-guard: health check is public for load balancer and uptime monitoring
export async function GET() {
  const start = performance.now();
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());
  const version = process.env.npm_package_version || '0.1.0';

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Probe database connectivity with a lightweight ping
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp,
        version,
        uptime,
        checks: {
          database: {
            status: 'connected',
            latencyMs,
          },
        },
      },
      { status: 200, headers }
    );
  } catch (error) {
    logError('Health check database probe failed', error, { uptime });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        version,
        uptime,
        checks: {
          database: {
            status: 'disconnected',
            error: 'Database unreachable',
          },
        },
      },
      { status: 503, headers }
    );
  }
}

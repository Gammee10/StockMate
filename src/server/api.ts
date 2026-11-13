// src/server/api.ts
import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { requireAdmin, requireUser, type SessionUser } from '@/server/auth';
import { toAppError } from '@/server/errors';
import { clientIp, rateLimit } from '@/server/rate-limit';
import { parseInput, readJson, readTextLimited } from '@/server/validate';
import { safeEqual, verifySignature } from '@/server/webhook';

type RouteCtx = { params: Promise<Record<string, string | string[] | undefined>> };
type Schemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };
type Parsed<S extends Schemas, K extends keyof Schemas> = S[K] extends z.ZodType
  ? z.infer<S[K]>
  : undefined;
type Args<S extends Schemas, U> = {
  params: Parsed<S, 'params'>;
  query: Parsed<S, 'query'>;
  body: Parsed<S, 'body'>;
  user: U;
  request: Request | NextRequest;
};
type Options = { rateLimit?: { key: string; limit: number; windowSeconds: number } };

const JSON_HEADERS = { 'Cache-Control': 'private, no-store' };

export function ok<T>(data: T, status = 200) {
  return Response.json({ data }, { status, headers: JSON_HEADERS });
}
export const created = <T>(data: T) => ok(data, 201);
export const noContent = () => new Response(null, { status: 204, headers: JSON_HEADERS });

function errorResponse(e: AppError) {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (e.retryAfter) headers['Retry-After'] = String(e.retryAfter);
  return Response.json(
    { error: { code: e.code, message: e.message, fields: e.fields } },
    { status: e.status, headers }
  );
}

function assertSameOrigin(request: Request | NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (!request.headers.has('cookie')) return;
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (hostOf(origin) !== host)
    throw new AppError('FORBIDDEN', 'Cross-site requests are not allowed.');
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export type ApiRoute = {
  (request: NextRequest, ctx: RouteCtx): Promise<Response>;
  (request: Request, ctx: RouteCtx): Promise<Response>;
  (request: NextRequest): Promise<Response>;
  (request: Request): Promise<Response>;
  (): Promise<Response>;
};

function build<S extends Schemas, U>(
  authenticate: (req: Request | NextRequest) => Promise<U>,
  schemas: S,
  handler: (args: Args<S, U>) => Promise<unknown>,
  options: Options
): ApiRoute {
  return (async (request?: Request | NextRequest, ctx?: RouteCtx): Promise<Response> => {
    const effectiveReq = request ?? new Request('http://localhost');
    const nextReq = effectiveReq as NextRequest;
    const url = nextReq.nextUrl ?? new URL(effectiveReq.url);
    try {
      assertSameOrigin(effectiveReq);
      const user = await authenticate(effectiveReq);
      if (options.rateLimit) {
        const who =
          user && typeof user === 'object' && 'id' in user
            ? String((user as { id: string }).id)
            : clientIp(effectiveReq.headers);
        await rateLimit(`${options.rateLimit.key}:${who}`, options.rateLimit);
      }
      const params = schemas.params
        ? parseInput(schemas.params, await ctx?.params)
        : undefined;
      const query = schemas.query
        ? parseInput(schemas.query, Object.fromEntries(url.searchParams))
        : undefined;
      const body = schemas.body
        ? parseInput(schemas.body, await readJson(effectiveReq))
        : undefined;
      const result = await handler({
        params,
        query,
        body,
        user,
        request: effectiveReq,
      } as Args<S, U>);
      return result instanceof Response ? result : ok(result);
    } catch (err) {
      unstable_rethrow(err);
      return errorResponse(
        toAppError(err, { route: url.pathname, method: effectiveReq.method })
      );
    }
  }) as ApiRoute;
}

type Handler<S extends Schemas, U> = (args: Args<S, U>) => Promise<unknown>;

/** Signed-in users only. */
export function userRoute<const S extends Schemas>(
  schemas: S,
  handler: Handler<S, SessionUser>,
  options: Options = {}
) {
  return build(requireUser, schemas, handler, options);
}

/** Admins only. */
export function adminRoute<const S extends Schemas>(
  schemas: S,
  handler: Handler<S, SessionUser>,
  options: Options = {}
) {
  return build(requireAdmin, schemas, handler, options);
}

/** Anyone, including signed-out visitors. Add a rateLimit option for anything that writes. */
export function publicRoute<const S extends Schemas>(
  schemas: S,
  handler: Handler<S, null>,
  options: Options = {}
) {
  return build(async () => null, schemas, handler, options);
}

/** A webhook from another service. */
export function webhookRoute<S extends z.ZodType>(
  options: { secret: () => string; signatureHeader?: string; body: S; maxBytes?: number },
  handler: (args: { event: z.infer<S> }) => Promise<unknown>
) {
  return async (request: Request | NextRequest): Promise<Response> => {
    try {
      const rawBody = await readTextLimited(request, options.maxBytes ?? 256_000);
      const valid = verifySignature({
        rawBody,
        header: request.headers.get(options.signatureHeader ?? 'x-signature'),
        secret: options.secret(),
      });
      if (!valid) throw new AppError('UNAUTHORIZED', 'Invalid signature.');
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        throw new AppError('BAD_REQUEST', 'The request body is not valid JSON.');
      }
      const event = parseInput(options.body, json);
      return ok(await handler({ event }));
    } catch (err) {
      unstable_rethrow(err);
      return errorResponse(
        toAppError(err, {
          route: ((request as NextRequest).nextUrl ?? new URL(request.url)).pathname,
          method: request.method,
        })
      );
    }
  };
}

/** A scheduled job. */
export function cronRoute(
  options: { secret: () => string | undefined },
  handler: () => Promise<unknown>
) {
  return async (request: Request | NextRequest): Promise<Response> => {
    try {
      const secret = options.secret();
      if (!secret) throw new Error('The cron secret is not set.');
      if (!safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
        throw new AppError('UNAUTHORIZED', 'Invalid token.');
      }
      return ok(await handler());
    } catch (err) {
      unstable_rethrow(err);
      return errorResponse(
        toAppError(err, {
          route: ((request as NextRequest).nextUrl ?? new URL(request.url)).pathname,
          method: request.method,
        })
      );
    }
  };
}

// proxy.ts  (Better Auth, Next 16). Only an optimistic check. Real checks happen in pages and routes.
import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/login", request.url))
  return NextResponse.next()
}

export const config = { matcher: ["/dashboard/:path*", "/invoices/:path*"] }

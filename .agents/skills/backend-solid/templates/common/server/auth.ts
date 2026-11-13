// server/auth.ts
import "server-only"
import { redirect } from "next/navigation"
import { AppError } from "@/lib/errors"

export type SessionUser = { id: string; email: string; role: "user" | "admin" }

/**
 * THE ONLY PLACE that talks to your auth library. Everything else calls requireUser().
 * Return the signed-in user or null. Never trust an id that came from the client.
 *
 * Better Auth:
 *   const session = await auth.api.getSession({ headers: await headers() })
 *   return session ? { id: session.user.id, email: session.user.email, role: "user" } : null
 * Auth.js v5 (next-auth@beta):
 *   const session = await auth()
 *   return session?.user?.id ? { id: session.user.id, email: session.user.email ?? "", role: "user" } : null
 * Clerk:
 *   const { userId } = await auth()   // from "@clerk/nextjs/server"
 *   ...look up your own user row by userId
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  throw new Error("Connect your auth library in server/auth.ts")
}

/** Signed-in users only. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AppError("UNAUTHORIZED", "Please sign in.")
  return user
}

/** Admins only. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== "admin") throw new AppError("FORBIDDEN", "You do not have access to this.")
  return user
}

/** For pages and layouts (Server Components). A signed-out visitor is sent to the sign-in page instead of seeing an error. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

// server/auth.ts
import "server-only"
import { redirect } from "next/navigation"
import { AppError } from "@/lib/errors"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export type SessionUser = { id: string; email: string; role: "user" | "admin" }

/**
 * THE ONLY PLACE that talks to Better Auth. Everything else calls requireUser().
 * Return the signed-in user or null. Never trust an id that came from the client.
 * Roles: add a `role` field to the user (Better Auth: user.additionalFields, or its admin plugin) and return it here.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  return { id: session.user.id, email: session.user.email, role: "user" }
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

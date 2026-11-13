// server/auth.ts
import "server-only"
import { redirect } from "next/navigation"
import { AppError } from "@/lib/errors"
import { auth, currentUser } from "@clerk/nextjs/server"

export type SessionUser = { id: string; email: string; role: "user" | "admin" }

/**
 * THE ONLY PLACE that talks to Clerk. Everything else calls requireUser().
 * Return the signed-in user or null. Never trust an id that came from the client.
 * Roles: keep a `role` in the user's public metadata and read it from sessionClaims, or look it up in your own users table.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser() // an extra network call. Fine to start; later keep your own users table in sync with a webhook.
  return { id: userId, email: user?.primaryEmailAddress?.emailAddress ?? "", role: "user" }
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

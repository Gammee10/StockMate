// test/helpers/http.ts
// Small helpers to call route handlers directly, without starting a server.
import { createHmac } from "node:crypto"
import { NextRequest } from "next/server"

export function request(
  method: string,
  path: string,
  options: { body?: unknown; raw?: string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(options.headers)
  let body: string | undefined
  if (options.raw !== undefined) {
    body = options.raw
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    if (!headers.has("content-type")) headers.set("content-type", "application/json")
  }
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body })
}

/** Next.js passes dynamic route params as a Promise. */
export const withParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

export async function read(response: Response) {
  const text = await response.text()
  // `data` is `any` on purpose: tests read fields of many different shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = text ? (JSON.parse(text) as { data?: any; error?: { code: string; message: string; fields?: Record<string, string[]> } }) : undefined
  return { status: response.status, body, headers: response.headers, text }
}

/** Builds a signature header the same way the payment provider does. */
export function sign(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  return `t=${timestamp},v1=${v1}`
}

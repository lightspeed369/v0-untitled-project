// Server-side admin authentication.
//
// The previous implementation compared the password against a hardcoded literal
// inside a client component, so the credential shipped in the public JS bundle and
// the check was bypassable by calling the API directly. Auth now lives on the
// server and the config write endpoint requires a signed session cookie.

import crypto from "crypto"

export const SESSION_COOKIE = "ls_admin_session"

/**
 * The single admin identity. Stamped on change-log entries and version snapshots.
 *
 * The server applies this itself rather than trusting an adminId sent by the browser,
 * so the attribution in the change log cannot be forged by hand-crafting a request.
 */
export const ADMIN_ID = "lsadmin"
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

const sha256 = (value: string) => crypto.createHash("sha256").update(value, "utf8").digest()

/** The admin password. No default — if unset, writes are refused (fail closed). */
const adminPassword = () => process.env.ADMIN_PASSWORD || ""

/**
 * Secret used to sign session cookies. Falls back to the admin password so a
 * single env var is enough to operate; set ADMIN_SESSION_SECRET to rotate
 * sessions independently of the password.
 */
const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || adminPassword()

/** True when an admin password is configured. Surfaced so the UI can explain itself. */
export const isAuthConfigured = () => adminPassword().length > 0

/** Constant-time password check. Both sides are hashed first so length isn't leaked. */
export const verifyPassword = (candidate: string): boolean => {
  const expected = adminPassword()
  if (!expected) return false
  return crypto.timingSafeEqual(sha256(candidate ?? ""), sha256(expected))
}

const sign = (payload: string) =>
  crypto.createHmac("sha256", sessionSecret()).update(payload, "utf8").digest("hex")

/** Issue an opaque `<expiry>.<hmac>` session token. */
export const issueSessionToken = (ttlMs: number = DEFAULT_TTL_MS): string => {
  const expiresAt = String(Date.now() + ttlMs)
  return `${expiresAt}.${sign(expiresAt)}`
}

/** Verify a session token: correct signature and not expired. */
export const verifySessionToken = (token?: string | null): boolean => {
  if (!token || !isAuthConfigured()) return false

  const separator = token.lastIndexOf(".")
  if (separator <= 0) return false

  const expiresAt = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  const expiry = Number(expiresAt)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false

  const expected = sign(expiresAt)
  // Both are hex of the same digest length, so lengths match unless the token is
  // malformed — guard anyway so timingSafeEqual can't throw.
  if (signature.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}

export const sessionCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
})

// Brute-force protection for the admin login.
//
// The password is a single shared secret on a publicly reachable panel, so unlimited
// guessing is the weak point regardless of how strong the password is. This adds
// per-client backoff: a few wrong guesses are free (typos), then attempts are refused
// for progressively longer.
//
// State is in-process. The app runs as one long-lived container, so that is sufficient
// and avoids adding a datastore. If it were ever scaled to multiple instances an
// attacker would get one allowance per instance, which is still a hard ceiling.

const FREE_ATTEMPTS = 5 // wrong guesses before backoff starts
const BASE_BLOCK_MS = 60_000 // first block: 1 minute
const MAX_BLOCK_MS = 15 * 60_000 // cap: 15 minutes
const FORGET_AFTER_MS = 60 * 60_000 // drop idle entries after an hour
const MAX_TRACKED = 10_000 // bound memory against distributed attempts

interface Entry {
  failures: number
  blockedUntil: number
  lastSeen: number
}

const attempts = new Map<string, Entry>()

/**
 * Identify the client.
 *
 * Takes the LAST value of x-forwarded-for, not the first: a client can send its own
 * x-forwarded-for header, and proxies append rather than replace, so the leftmost entry
 * is attacker-controlled while the rightmost was added by the proxy in front of us.
 * Using the first would let anyone reset their own limit at will.
 */
export const clientKey = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return request.headers.get("x-real-ip") || "unknown"
}

const prune = (now: number) => {
  for (const [key, entry] of attempts) {
    if (now - entry.lastSeen > FORGET_AFTER_MS) attempts.delete(key)
  }
  if (attempts.size > MAX_TRACKED) {
    // Evict the least recently seen entries.
    const sorted = [...attempts.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)
    for (const [key] of sorted.slice(0, attempts.size - MAX_TRACKED)) attempts.delete(key)
  }
}

/** Is this client currently blocked? Returns seconds remaining, or 0 if allowed. */
export const retryAfterSeconds = (key: string): number => {
  const entry = attempts.get(key)
  if (!entry) return 0
  const remaining = entry.blockedUntil - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

/** Record a failed attempt and apply backoff once the free allowance is used up. */
export const recordFailure = (key: string): void => {
  const now = Date.now()
  prune(now)

  const entry = attempts.get(key) ?? { failures: 0, blockedUntil: 0, lastSeen: now }
  entry.failures += 1
  entry.lastSeen = now

  if (entry.failures > FREE_ATTEMPTS) {
    const over = entry.failures - FREE_ATTEMPTS
    const block = Math.min(BASE_BLOCK_MS * 2 ** (over - 1), MAX_BLOCK_MS)
    entry.blockedUntil = now + block
  }

  attempts.set(key, entry)
}

/** Successful login clears the client's history. */
export const recordSuccess = (key: string): void => {
  attempts.delete(key)
}

/** Test/diagnostic helper. */
export const resetRateLimits = (): void => {
  attempts.clear()
}

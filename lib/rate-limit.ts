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
 * Identify the client: the FIRST value of x-forwarded-for.
 *
 * The usual advice is to prefer the rightmost entry, because clients can forge
 * x-forwarded-for and proxies that append leave the leftmost value attacker-controlled.
 * That advice is wrong for this deployment, and the first implementation here got it
 * wrong as a result.
 *
 * Verified against Railway by logging the header as received:
 *
 *   xff=108.224.88.209, 84.17.44.225      <- real client, then a Railway hop
 *   xff=108.224.88.209, 84.17.44.228      <- same client, DIFFERENT hop
 *
 * Two things follow. The trailing hop rotates across Railway's fleet per request, so
 * keying on it hands every request a fresh bucket and the limiter never engages. And
 * Railway discards any x-forwarded-for the client sends — a request with
 * "X-Forwarded-For: 9.9.9.9" still arrived as "108.224.88.209, <hop>" — so the leftmost
 * entry is set by the proxy, not the caller, and is safe to trust here.
 *
 * If this is ever moved behind a different proxy, re-verify: the safety of the leftmost
 * value depends on the proxy replacing the header rather than appending to it.
 */
export const clientKey = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length) return parts[0]
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

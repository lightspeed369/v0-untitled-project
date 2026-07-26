# Tests

End-to-end checks that run against a real production build — no test framework, no
dependencies beyond Python 3 (already needed for nothing else, so nothing to install).

```bash
pnpm install
pnpm build
tests/run_all.sh
```

Each suite boots its own server on its own port with its own throwaway `DATA_DIR` under
the system temp directory, so suites never touch each other or any real data.

| Suite | Covers |
|---|---|
| `test_core.py` | seeding from `data/config.seed.json` rather than code defaults, admin auth, session cookies, malformed-payload rejection, persistence across restart, fail-closed with no `ADMIN_PASSWORD`, no credential in the client bundle |
| `test_resilience.py` | concurrent writes, tampered/expired/forged session tokens, password rotation invalidating sessions, corrupt `config.json` quarantine, read-only volume degradation, the standalone server Railway actually runs |
| `test_versions.py` | snapshot on every write, rollback, rollback being itself undoable, retention cap, path-traversal rejection on version ids, server-stamped attribution |
| `test_ratelimit.py` | login backoff, per-client isolation, no oracle while blocked, `X-Forwarded-For` spoofing |

## Why these exist

Most of them encode a bug that was actually shipped, so they stop it coming back:

- Config seeded from `lib/track-config.ts` instead of the exported live data would
  silently revert months of admin edits — the committed defaults have drifted from
  production and always will, because config is edited in the browser by design.
- `POST /api/config` once accepted anonymous writes, and the admin password was
  compared in the browser, so it shipped in the public JS bundle.
- `store.ts` imported a helper from a `"use client"` module, so any write that omitted
  `changeDetails` returned 500.
- Modification names appear twice — in the category array and as a key in
  `scoreLookupTable`. Renaming one without the other makes points silently resolve to
  `undefined`.
- A truncated `config.json` used to be indistinguishable from "no config yet", which
  would re-seed over live data.

## Notes

- `test_ratelimit.py` deliberately exhausts the login allowance, which is why it runs
  its own server and simulates clients with `X-Forwarded-For`.
- If a suite fails at startup with "server did not start", the build is stale — re-run
  `pnpm build`.

# Deployment (Railway)

The LightSpeed Time Trial Classification Calculator. Public calculator at `/`,
admin panel at `/admin`.

## Why this moved off Vercel

Config was stored in Vercel KV, and the admin password was a string compared in the
browser. The app now stores config as a JSON file on a persistent volume and verifies
the password server-side, so it runs anywhere a disk can be mounted.

## Railway setup

1. **Create the service** from this repo. `railway.json` selects the Dockerfile
   builder; no build command needed.

2. **Attach a volume** — this is the part that must not be skipped. Without it the
   container filesystem is ephemeral and every admin save is lost on redeploy.
   - Mount path: `/data`
   - The Dockerfile already sets `DATA_DIR=/data`.

3. **Set variables**:

   | Variable | Required | Notes |
   |---|---|---|
   | `ADMIN_PASSWORD` | yes | Admin panel password. Pick a strong one; it is never sent to the browser. |
   | `ADMIN_SESSION_SECRET` | no | Signs session cookies. Defaults to `ADMIN_PASSWORD`. |
   | `DATA_DIR` | no | Defaults to `/data` in the image. Only set it if the volume is mounted elsewhere. |

   If `ADMIN_PASSWORD` is unset the app **fails closed**: the calculator still works,
   but login and config writes return 503. That is deliberate — the previous behaviour
   was an unauthenticated write endpoint.

4. **Health check** is `/api/config/status`, already set in `railway.json`. It returns
   the resolved data directory and whether it is writable.

## First boot and data

On first boot, if `$DATA_DIR/config.json` does not exist, it is created from
`data/config.seed.json`, which contains the live production data exported from Vercel
KV (30 makes / 165 models / 24 change-log entries, as of 2026-03-04).

This matters: `lib/track-config.ts` has drifted from production (it is missing 12
models, has 4 that were removed, and disagrees on 23 classifications). The seed is
preferred over those defaults precisely so a deploy cannot silently revert live
classifications. `track-config.ts` is only used if the seed file is also absent.

If `config.json` exists but is unreadable, it is renamed to
`config.json.corrupt-<timestamp>` and the seed is used. The corrupt file is never
overwritten, so it can be recovered by hand.

## Verifying a deploy

```bash
BASE=https://<your-domain>

# Persistence is on (must be true, or the volume isn't mounted)
curl -s $BASE/api/config/status

# Config is served and complete
curl -s $BASE/api/config | python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(len(v) for v in d['config']['models'].values()),'models')"

# Anonymous writes are refused (expect 401)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/config \
  -H 'Content-Type: application/json' -d '{"config":{"models":{"x":{}}}}'
```

Then log in at `/admin`, make a trivial change, save, and redeploy — the change must
survive. That is the behaviour Vercel could not provide.

## Local development

```bash
pnpm install
ADMIN_PASSWORD=dev-password pnpm dev      # config written to ./data
```

## Backups

The whole dataset is one small JSON file. To back it up:

```bash
curl -s https://<your-domain>/api/config > backup-$(date +%F).json
```

`data/config.seed.json` in this repo is itself a point-in-time backup.

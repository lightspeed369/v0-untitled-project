# lightspeedta-calculator — Time Trial classification calculator

Next.js app drivers use to work out which Time Trial class they run in. Public
calculator at `/`, admin panel at `/admin`.

GitHub repo is `lightspeed369/v0-untitled-project` — the name is a leftover from its v0
origin, not a mistake.

## Layout

| Path | What it is |
|---|---|
| `app/` | Next.js routes — `/` public calculator, `/admin` config panel |
| `components/` | UI (53 files) |
| `lib/`, `hooks/`, `data/` | Classification logic and defaults |
| `tests/` | Test suite |
| `DEPLOYMENT.md` | Railway setup. **Read before deploying.** |
| `Dockerfile`, `railway.json` | Container build |

## Working on it

```sh
npm install
npm run dev
npm test
```

## Rules that are easy to get wrong

- **The Railway volume is not optional.** Config is a JSON file on a persistent volume
  mounted at `/data` (`DATA_DIR=/data` is already set in the Dockerfile). Without the
  volume the filesystem is ephemeral and **every admin save is lost on redeploy**.
- **Live config has diverged from the committed defaults in `data/`.** Don't assume the
  repo reflects what drivers see — check the live admin panel before quoting class
  boundaries.
- **Old Vercel URLs are dead.** It moved off Vercel because config lived in Vercel KV
  and the admin password was compared *in the browser*; it's now verified server-side.
  Don't reintroduce client-side auth checks.
- `main` is the current branch — several older `chore/*` and `fix/*` branches are stale.

## Branches & shipping

Default branch `main`, auto-deploys to Railway. Work on a branch, PR into `main`.
Don't push to `main` directly.

## Docs

`DEPLOYMENT.md` at root. New workstreams get `docs/projects/<slug>/` (see Conventions).

## Conventions

Shared across all repos under `~/LS`:

- **`CLAUDE.md` at repo root** with these same headings, so any agent session gets
  oriented the same way in any project.
- **A folder per project** — `docs/projects/<slug>/README.md` — once a repo covers
  more than one distinct workstream. Each README names the files that implement it,
  the decisions behind it, and the open questions.
- **Record why, not just what.** What the code does is recoverable by reading it.
- **Date your claims.** Put an "as of" line on anything that describes live state.
- **No credentials in git**, ever — check `.gitignore` before adding files.

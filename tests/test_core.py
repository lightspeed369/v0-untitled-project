#!/usr/bin/env python3
"""End-to-end verification of the security fixes + volume-backed persistence."""
import json, os, tempfile, shutil, subprocess, sys, time, urllib.error, urllib.request

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(tempfile.gettempdir(), "lsta-test-testdata")
PORT = 3120
BASE = f"http://localhost:{PORT}"
PASSWORD = "test-password-not-a-real-secret"

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def req(path, method="GET", body=None, cookie=None):
    r = urllib.request.Request(BASE + path, method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.data = json.dumps(body).encode()
    if cookie:
        r.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw), resp.headers
            except Exception:
                return resp.status, raw.decode("utf8", "replace"), resp.headers
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw), e.headers
        except Exception:
            return e.code, raw.decode("utf8", "replace"), e.headers


def start():
    env = {**os.environ, "DATA_DIR": DATA, "ADMIN_PASSWORD": PASSWORD,
           "PATH": "/opt/homebrew/bin:" + os.environ.get("PATH", "")}
    p = subprocess.Popen([os.path.join(WORK,"node_modules",".bin","next"), "start", "-p", str(PORT)],
                         cwd=WORK, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE, timeout=2)
            return p
        except Exception:
            time.sleep(1)
    p.kill(); sys.exit("server did not start")


def stop(p):
    p.terminate()
    try:
        p.wait(timeout=15)
    except Exception:
        p.kill()


shutil.rmtree(DATA, ignore_errors=True)

print("\n=== 1. FIRST BOOT: seeds volume from production data ===")
srv = start()
st, cfg, _ = req("/api/config")
total = sum(len(v) for v in cfg["config"]["models"].values())
check("GET /api/config returns 200", st == 200, f"status={st}")
check("seeded from PRODUCTION data (165 models), not code defaults (157)",
      total == 165, f"models={total}")
check("production changelog preserved (24 entries)", len(cfg["changeLog"]) == 24,
      f"entries={len(cfg['changeLog'])}")
check("isPersistenceEnabled is true on a writable volume", cfg["isPersistenceEnabled"] is True)
check("config.json created on the volume", os.path.exists(f"{DATA}/config.json"))
check("a prod-only model is present (Lotus Evora GT)",
      "Evora GT" in cfg["config"]["models"].get("Lotus", {}))
check("a prod-only $ indicator survived (Mercedes AMG GT S = TTB$)",
      cfg["config"]["models"]["Mercedes"]["AMG GT S"]["baseClass"] == "TTB$")

print("\n=== 2. AUTH: writes rejected without a session ===")
st, body, _ = req("/api/config", "POST", {"config": cfg["config"], "changeDetails": "x"})
check("unauthenticated POST /api/config -> 401", st == 401, f"status={st}")
check("401 body explains why", isinstance(body, dict) and "authenticated" in body.get("message", "").lower())

st, body, _ = req("/api/admin/login", "POST", {"password": "wrong-password"})
check("login with wrong password -> 401", st == 401, f"status={st}")

st, body, hdrs = req("/api/admin/login", "POST", {"password": PASSWORD})
check("login with correct password -> 200", st == 200, f"status={st}")
setc = hdrs.get("Set-Cookie", "") if hdrs else ""
check("session cookie is httpOnly", "httponly" in setc.lower(), setc.split(";")[0] if setc else "none")
cookie = setc.split(";")[0] if setc else None

st, body, _ = req("/api/admin/session", cookie=cookie)
check("session endpoint confirms authenticated", st == 200 and body.get("authenticated") is True)

print("\n=== 3. AUTHORISED WRITE + the client/server boundary fix ===")
new = json.loads(json.dumps(cfg["config"]))
new["models"].setdefault("Verify", {})["Test Car"] = {"baseClass": "TTC*"}
# changeDetails deliberately OMITTED -> this used to 500 (client fn called on server)
st, body, _ = req("/api/config", "POST",
                  {"config": new, "adminId": "verify-suite", "action": "verification write"},
                  cookie=cookie)
check("authorised POST without changeDetails -> 200 (was 500)", st == 200,
      f"status={st} msg={body.get('message') if isinstance(body,dict) else body}")
if isinstance(body, dict) and body.get("changeLog"):
    check("server generated the change description itself",
          "Verify" in json.dumps(body["changeLog"][0]), body["changeLog"][0].get("details", "")[:60])

st, cfg2, _ = req("/api/config")
check("write is reflected on read",
      "Verify" in cfg2["config"]["models"], f"models={sum(len(v) for v in cfg2['config']['models'].values())}")

print("\n=== 4. MALFORMED PAYLOAD GUARD ===")
st, body, _ = req("/api/config", "POST", {"config": {"models": {}}, "changeDetails": "wipe"}, cookie=cookie)
check("empty-models payload rejected -> 400", st == 400, f"status={st}")
st, body, _ = req("/api/config", "POST", {"changeDetails": "no config"}, cookie=cookie)
check("missing config rejected -> 400", st == 400, f"status={st}")

print("\n=== 5. PERSISTENCE ACROSS RESTART (the Vercel KV -> volume win) ===")
stop(srv)
srv = start()
st, cfg3, _ = req("/api/config")
check("change survived a full server restart", "Verify" in cfg3["config"]["models"], f"status={st}")
check("changelog grew and persisted", len(cfg3["changeLog"]) == 25, f"entries={len(cfg3['changeLog'])}")
check("session cookie rejected after restart? (secret is stable, so still valid)",
      req("/api/admin/session", cookie=cookie)[1].get("authenticated") is True)

print("\n=== 6. STATUS ENDPOINT REPORTS REAL HEALTH ===")
st, status, _ = req("/api/config/status")
check("status 200", st == 200)
check("reports the actual data dir", status.get("dataDir") == DATA, status.get("dataDir", ""))
check("reports dir writable", status.get("dataDirectoryWritable") is True)
check("reports config file exists", status.get("configFileExists") is True)

print("\n=== 7. PUBLIC CALCULATOR UNAFFECTED ===")
st, html, _ = req("/")
check("GET / -> 200", st == 200)
check("page still renders the calculator", "LightSpeed Time Trial Classification Calculator" in html)
st, _, _ = req("/admin")
check("GET /admin -> 200", st == 200)

print("\n=== 8. NO CREDENTIAL IN THE CLIENT BUNDLE ===")
found = []
for root, _, files in os.walk(f"{WORK}/.next/static"):
    for f in files:
        if f.endswith(".js"):
            blob = open(os.path.join(root, f), "rb").read()
            if PASSWORD.encode() in blob or b"admin123" in blob:
                found.append(f)
check("no admin password shipped to the browser", not found, ",".join(found) or "clean")

print("\n=== 9. FAIL-CLOSED WHEN ADMIN_PASSWORD IS UNSET ===")
stop(srv)
env = {**os.environ, "DATA_DIR": DATA, "PATH": "/opt/homebrew/bin:" + os.environ.get("PATH", "")}
env.pop("ADMIN_PASSWORD", None)
p2 = subprocess.Popen([os.path.join(WORK,"node_modules",".bin","next"), "start", "-p", str(PORT)],
                      cwd=WORK, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        urllib.request.urlopen(BASE, timeout=2); break
    except Exception:
        time.sleep(1)
st, body, _ = req("/api/config", "POST", {"config": cfg["config"], "changeDetails": "x"})
check("write refused (503) when no password configured", st == 503, f"status={st}")
st, body, _ = req("/api/admin/login", "POST", {"password": "anything"})
check("login refused (503) when no password configured", st == 503, f"status={st}")
st, body, _ = req("/api/config")
check("public read still works with no password configured", st == 200)
stop(p2)

print(f"\n{'='*60}\nPASSED {len(passed)}   FAILED {len(failed)}")
if failed:
    print("FAILURES:")
    for f in failed:
        print("  -", f)
sys.exit(1 if failed else 0)

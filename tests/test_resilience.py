#!/usr/bin/env python3
"""Corner cases: concurrency, session tampering, corruption, read-only volume."""
import concurrent.futures as cf
import tempfile
import hashlib, hmac, json, os, shutil, subprocess, sys, time, urllib.error, urllib.request

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(tempfile.gettempdir(), "lsta-test-edgedata")
PORT = 3130
BASE = f"http://localhost:{PORT}"
PASSWORD = "edge-test-password"

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def req(path, method="GET", body=None, cookie=None, port=PORT):
    r = urllib.request.Request(f"http://localhost:{port}{path}", method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.data = json.dumps(body).encode()
    if cookie:
        r.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
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


def start(port=PORT, data=DATA, password=PASSWORD, cmd=None, cwd=WORK):
    env = {**os.environ, "DATA_DIR": data, "PATH": "/opt/homebrew/bin:" + os.environ.get("PATH", "")}
    if password:
        env["ADMIN_PASSWORD"] = password
    else:
        env.pop("ADMIN_PASSWORD", None)
    env["PORT"] = str(port)
    cmd = cmd or [os.path.join(WORK,"node_modules",".bin","next"), "start", "-p", str(port)]
    p = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://localhost:{port}", timeout=2)
            return p
        except Exception:
            time.sleep(1)
    out = p.stdout.read(3000).decode("utf8", "replace") if p.stdout else ""
    p.kill()
    sys.exit(f"server on {port} did not start:\n{out}")


def stop(p):
    p.terminate()
    try:
        p.wait(timeout=15)
    except Exception:
        p.kill()


def login(port=PORT, password=PASSWORD):
    _, _, h = req("/api/admin/login", "POST", {"password": password}, port=port)
    return h.get("Set-Cookie", "").split(";")[0]


shutil.rmtree(DATA, ignore_errors=True)

print("\n=== A. CONCURRENT WRITES (atomicity + write queue) ===")
srv = start()
cookie = login()
_, base, _ = req("/api/config")
baseline_log = len(base["changeLog"])


def writer(i):
    cfg = json.loads(json.dumps(base["config"]))
    cfg["models"].setdefault("Concurrent", {})[f"Car {i}"] = {"baseClass": "TTD"}
    st, body, _ = req("/api/config", "POST",
                      {"config": cfg, "adminId": f"writer-{i}", "action": f"concurrent write {i}"},
                      cookie=cookie)
    return st


with cf.ThreadPoolExecutor(max_workers=12) as ex:
    codes = list(ex.map(writer, range(12)))
check("all 12 concurrent writes returned 200", set(codes) == {200}, f"codes={sorted(set(codes))}")

on_disk = open(f"{DATA}/config.json").read()
try:
    parsed = json.loads(on_disk)
    valid = True
except Exception as e:
    parsed, valid = None, False
check("config.json on disk is valid JSON after concurrent writes", valid)
check("no partial write: file has the full model set",
      valid and sum(len(v) for v in parsed["config"]["models"].values()) >= 165,
      f"models={sum(len(v) for v in parsed['config']['models'].values()) if valid else 'n/a'}")
check("changelog recorded all 12 writes (serialised, none lost)",
      valid and len(parsed["changeLog"]) == min(50, baseline_log + 12),
      f"entries={len(parsed['changeLog']) if valid else 'n/a'} expected={min(50, baseline_log+12)}")
leftovers = [f for f in os.listdir(DATA) if ".tmp" in f]
check("no temp files left behind", not leftovers, ",".join(leftovers) or "clean")

print("\n=== B. SESSION TOKEN TAMPERING / EXPIRY ===")
st, _, _ = req("/api/config", "POST", {"config": base["config"], "changeDetails": "x"},
               cookie="ls_admin_session=garbage")
check("garbage cookie rejected -> 401", st == 401, f"status={st}")

valid_tok = cookie.split("=", 1)[1]
exp, sig = valid_tok.rsplit(".", 1)
# flip one hex char of the signature
bad_sig = ("0" if sig[0] != "0" else "1") + sig[1:]
st, _, _ = req("/api/config", "POST", {"config": base["config"], "changeDetails": "x"},
               cookie=f"ls_admin_session={exp}.{bad_sig}")
check("tampered signature rejected -> 401", st == 401, f"status={st}")

# extend expiry but keep old signature -> must fail
st, _, _ = req("/api/config", "POST", {"config": base["config"], "changeDetails": "x"},
               cookie=f"ls_admin_session={int(exp)+10**9}.{sig}")
check("extended expiry with stale signature rejected -> 401", st == 401, f"status={st}")

# correctly-signed but already expired -> must fail
past = str(int(time.time() * 1000) - 5000)
good_past_sig = hmac.new(PASSWORD.encode(), past.encode(), hashlib.sha256).hexdigest()
st, _, _ = req("/api/config", "POST", {"config": base["config"], "changeDetails": "x"},
               cookie=f"ls_admin_session={past}.{good_past_sig}")
check("correctly-signed but EXPIRED token rejected -> 401", st == 401, f"status={st}")

# sanity: a correctly-signed future token IS accepted (proves the HMAC scheme under test)
future = str(int(time.time() * 1000) + 600000)
good_sig = hmac.new(PASSWORD.encode(), future.encode(), hashlib.sha256).hexdigest()
st, _, _ = req("/api/admin/session", cookie=f"ls_admin_session={future}.{good_sig}")
check("correctly-signed unexpired token accepted (HMAC scheme verified)",
      st == 200 and req("/api/admin/session", cookie=f"ls_admin_session={future}.{good_sig}")[1]["authenticated"] is True)

print("\n=== C. SESSION INVALIDATED WHEN PASSWORD CHANGES ===")
stop(srv)
srv = start(password="a-different-password")
st, body, _ = req("/api/admin/session", cookie=cookie)
check("old session rejected after password rotation", body.get("authenticated") is False)
st, _, _ = req("/api/config", "POST", {"config": base["config"], "changeDetails": "x"}, cookie=cookie)
check("old cookie can no longer write -> 401", st == 401, f"status={st}")

print("\n=== D. CORRUPT config.json IS QUARANTINED, NOT SILENTLY REVERTED ===")
stop(srv)
good = open(f"{DATA}/config.json").read()
open(f"{DATA}/config.json", "w").write(good[: len(good) // 2])  # truncate = corrupt
srv = start()
st, cfg, _ = req("/api/config")
check("server still serves config after corruption", st == 200, f"status={st}")
quarantined = [f for f in os.listdir(DATA) if ".corrupt-" in f]
check("corrupt file preserved for recovery", len(quarantined) == 1, ",".join(quarantined) or "none")
if quarantined:
    check("quarantined copy holds the original bytes",
          open(os.path.join(DATA, quarantined[0])).read() == good[: len(good) // 2])
check("re-seeded with production data (165 models)",
      sum(len(v) for v in cfg["config"]["models"].values()) == 165,
      f"models={sum(len(v) for v in cfg['config']['models'].values())}")

print("\n=== E. READ-ONLY VOLUME DEGRADES SAFELY ===")
stop(srv)
RO = os.path.join(tempfile.gettempdir(), "lsta-test-rodata")
shutil.rmtree(RO, ignore_errors=True)
os.makedirs(RO)
os.chmod(RO, 0o500)  # r-x: readable, not writable
srv = start(data=RO)
st, cfg, _ = req("/api/config")
check("GET works on a read-only volume", st == 200, f"status={st}")
check("serves seed data rather than failing",
      st == 200 and sum(len(v) for v in cfg["config"]["models"].values()) == 165)
check("isPersistenceEnabled correctly reports false", cfg.get("isPersistenceEnabled") is False)
st, status, _ = req("/api/config/status")
check("status reports dir not writable", status.get("dataDirectoryWritable") is False)
c2 = login()
st, body, _ = req("/api/config", "POST",
                  {"config": cfg["config"], "adminId": "ro", "action": "should fail"}, cookie=c2)
check("write on read-only volume fails loudly -> 500", st == 500, f"status={st}")
check("error names the directory", isinstance(body, dict) and RO in str(body.get("error", "")),
      str(body.get("error", ""))[:70] if isinstance(body, dict) else "")
stop(srv)
os.chmod(RO, 0o700)

print("\n=== F. STANDALONE SERVER (what Railway actually runs) ===")
sa = f"{WORK}/.next/standalone"
if not os.path.isdir(sa):
    check("standalone output exists", False, "missing .next/standalone")
else:
    shutil.copytree(f"{WORK}/public", f"{sa}/public", dirs_exist_ok=True)
    os.makedirs(f"{sa}/.next", exist_ok=True)
    shutil.copytree(f"{WORK}/.next/static", f"{sa}/.next/static", dirs_exist_ok=True)
    os.makedirs(f"{sa}/data", exist_ok=True)
    shutil.copy(f"{WORK}/data/config.seed.json", f"{sa}/data/config.seed.json")
    SA_DATA = os.path.join(tempfile.gettempdir(), "lsta-test-sadata")
    shutil.rmtree(SA_DATA, ignore_errors=True)
    p = start(port=3131, data=SA_DATA, cmd=["node", "server.js"], cwd=sa)
    st, cfg, _ = req("/api/config", port=3131)
    check("standalone: GET /api/config -> 200", st == 200, f"status={st}")
    check("standalone: seeded production data", st == 200 and sum(len(v) for v in cfg["config"]["models"].values()) == 165)
    st, html, _ = req("/", port=3131)
    check("standalone: calculator page renders",
          st == 200 and "LightSpeed Time Trial Classification Calculator" in html)
    st, _, _ = req("/api/config", "POST", {"config": cfg["config"], "changeDetails": "x"}, port=3131)
    check("standalone: unauthenticated write blocked -> 401", st == 401, f"status={st}")
    c3 = login(port=3131)
    st, _, _ = req("/api/config", "POST",
                   {"config": cfg["config"], "adminId": "sa", "action": "standalone write"},
                   cookie=c3, port=3131)
    check("standalone: authorised write -> 200", st == 200, f"status={st}")
    check("standalone: persisted to volume", os.path.exists(f"{SA_DATA}/config.json"))
    stop(p)

print(f"\n{'='*60}\nPASSED {len(passed)}   FAILED {len(failed)}")
if failed:
    print("FAILURES:")
    for f in failed:
        print("  -", f)
sys.exit(1 if failed else 0)

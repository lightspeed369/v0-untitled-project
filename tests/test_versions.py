#!/usr/bin/env python3
"""Snapshot + rollback: correctness, retention, auth, and path-traversal safety."""
import json, os, tempfile, shutil, subprocess, sys, time, urllib.error, urllib.request

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(tempfile.gettempdir(), "lsta-test-vdata")
PORT = 3160
BASE = f"http://localhost:{PORT}"
PASSWORD = "versions-test-pass"

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


def start():
    env = {**os.environ, "DATA_DIR": DATA, "ADMIN_PASSWORD": PASSWORD,
           "PATH": "/opt/homebrew/bin:" + os.environ.get("PATH", "")}
    p = subprocess.Popen([os.path.join(WORK,"node_modules",".bin","next"), "start", "-p", str(PORT)],
                         cwd=WORK, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE, timeout=2); return p
        except Exception:
            time.sleep(1)
    p.kill(); sys.exit("server did not start")


def stop(p):
    p.terminate()
    try: p.wait(timeout=15)
    except Exception: p.kill()


def save(cfg, cookie, label):
    return req("/api/config", "POST",
               {"config": cfg, "adminId": "tester", "action": label, "changeDetails": label},
               cookie=cookie)


shutil.rmtree(DATA, ignore_errors=True)
srv = start()
_, _, h = req("/api/admin/login", "POST", {"password": PASSWORD})
cookie = h.get("Set-Cookie", "").split(";")[0]

print("\n=== A. AUTH ===")
s, _, _ = req("/api/config/versions")
check("listing versions without a session -> 401", s == 401, f"status={s}")
s, _, _ = req("/api/config/versions/v-2026-01-01T00-00-00-000Z", "POST", {})
check("restoring without a session -> 401", s == 401, f"status={s}")

print("\n=== B. SNAPSHOT ON WRITE ===")
s, base, _ = req("/api/config")
original_models = sum(len(v) for v in base["config"]["models"].values())
s, versions, _ = req("/api/config/versions", cookie=cookie)
check("no versions before the first save", versions["versions"] == [], f"n={len(versions['versions'])}")

cfg = json.loads(json.dumps(base["config"]))
cfg["models"].setdefault("SnapTest", {})["Car A"] = {"baseClass": "TTA"}
s, _, _ = save(cfg, cookie, "add SnapTest Car A")
check("first save succeeds", s == 200, f"status={s}")
s, versions, _ = req("/api/config/versions", cookie=cookie)
v = versions["versions"]
check("a version was captured", len(v) == 1, f"n={len(v)}")
check("version records the PRE-change model count", v[0]["modelCount"] == original_models,
      f"{v[0]['modelCount']} vs {original_models}")
check("version notes what superseded it", "SnapTest" in v[0]["note"], v[0]["note"][:40])
check("version is stamped with the server-side admin id", v[0]["adminId"] == "lsadmin", v[0]["adminId"])

print("\n=== C. ROLLBACK ===")
cfg2 = json.loads(json.dumps(cfg))
cfg2["models"]["SnapTest"]["Car B"] = {"baseClass": "TTB"}
save(cfg2, cookie, "add SnapTest Car B")
s, cur, _ = req("/api/config")
check("two cars live before rollback",
      len(cur["config"]["models"]["SnapTest"]) == 2, f"n={len(cur['config']['models']['SnapTest'])}")

s, versions, _ = req("/api/config/versions", cookie=cookie)
oldest = versions["versions"][-1]["id"]           # the pristine, pre-SnapTest config
s, body, _ = req(f"/api/config/versions/{oldest}", "POST", {"adminId": "restorer"}, cookie=cookie)
check("restore returns 200", s == 200, f"status={s}")
s, after, _ = req("/api/config")
check("live config rolled back (SnapTest gone)", "SnapTest" not in after["config"]["models"])
check("model count matches the restored version",
      sum(len(v) for v in after["config"]["models"].values()) == original_models)
check("restore appended to the change log, not rewrote it",
      after["changeLog"][0]["action"] == "Configuration restored" and len(after["changeLog"]) > len(base["changeLog"]),
      after["changeLog"][0]["action"])
check("restore is stamped with the server-side admin id", after["changeLog"][0]["adminId"] == "lsadmin",
      after["changeLog"][0]["adminId"])

print("\n=== D. THE RESTORE IS ITSELF UNDOABLE ===")
s, versions, _ = req("/api/config/versions", cookie=cookie)
newest = versions["versions"][0]
check("restoring created a snapshot of the pre-restore state",
      newest["modelCount"] == original_models + 2, f"modelCount={newest['modelCount']}")
s, _, _ = req(f"/api/config/versions/{newest['id']}", "POST", {"adminId": "undo"}, cookie=cookie)
s, back, _ = req("/api/config")
check("undoing the rollback brings both cars back",
      back["config"]["models"].get("SnapTest") and len(back["config"]["models"]["SnapTest"]) == 2,
      f"n={len(back['config']['models'].get('SnapTest', {}))}")

print("\n=== E. PATH TRAVERSAL / MALFORMED IDS ===")
for bad in ["../config", "..%2Fconfig", "v-../../etc/passwd", "config", "....//config",
            "v-2026-01-01T00-00-00-000Z/../../config"]:
    s, _, _ = req(f"/api/config/versions/{urllib.request.quote(bad, safe='')}", cookie=cookie)
    check(f"reject id {bad!r}", s in (400, 404), f"status={s}")
s, _, _ = req("/api/config/versions/v-2099-01-01T00-00-00-000Z", "POST", {}, cookie=cookie)
check("restoring an unknown (well-formed) id -> 404", s == 404, f"status={s}")
check("config.json was not clobbered by any of that",
      json.load(urllib.request.urlopen(BASE + "/api/config", timeout=30))["config"]["models"].get("SnapTest") is not None)
check("no stray files escaped the versions dir",
      sorted(os.listdir(DATA)) == ["config.json", "versions"], str(sorted(os.listdir(DATA))))

print("\n=== F. RETENTION (max 20) ===")
cur = json.load(urllib.request.urlopen(BASE + "/api/config", timeout=30))["config"]
for i in range(24):
    cur = json.loads(json.dumps(cur))
    cur["models"].setdefault("Churn", {})[f"Car {i}"] = {"baseClass": "TTE"}
    save(cur, cookie, f"churn {i}")
s, versions, _ = req("/api/config/versions", cookie=cookie)
n = len(versions["versions"])
check("version count capped at 20", n == 20, f"n={n}")
files = [f for f in os.listdir(f"{DATA}/versions") if f.endswith(".json")]
check("on-disk snapshots also capped", len(files) == 20, f"files={len(files)}")
check("no temp files left in versions dir",
      not [f for f in os.listdir(f"{DATA}/versions") if ".tmp" in f])
check("newest-first ordering",
      versions["versions"][0]["savedAt"] >= versions["versions"][-1]["savedAt"])

print("\n=== G. SURVIVES RESTART ===")
stop(srv)
srv = start()
_, _, h = req("/api/admin/login", "POST", {"password": PASSWORD})
cookie = h.get("Set-Cookie", "").split(";")[0]
s, versions, _ = req("/api/config/versions", cookie=cookie)
check("versions still present after restart", len(versions["versions"]) == 20, f"n={len(versions['versions'])}")
target = versions["versions"][5]["id"]
s, one, _ = req(f"/api/config/versions/{target}", cookie=cookie)
check("can read an individual version", s == 200 and "config" in one, f"status={s}")
check("individual version carries a full config",
      isinstance(one.get("config", {}).get("models"), dict) and len(one["config"]["models"]) > 5)

print("\n=== H. ATTRIBUTION CANNOT BE FORGED ===")
# Run last so the extra write cannot perturb earlier sequencing.
_, live, _ = req("/api/config")
spoof = json.loads(json.dumps(live["config"]))
spoof["models"].setdefault("SpoofTest", {})["X"] = {"baseClass": "TTE"}
s, _, _ = req("/api/config", "POST",
              {"config": spoof, "adminId": "someone-else", "action": "spoof attempt",
               "changeDetails": "spoof"}, cookie=cookie)
check("write accepted", s == 200, f"status={s}")
_, spoofed, _ = req("/api/config")
check("client-supplied adminId is IGNORED (cannot forge attribution)",
      spoofed["changeLog"][0]["adminId"] == "lsadmin", spoofed["changeLog"][0]["adminId"])
_, vv, _ = req("/api/config/versions", cookie=cookie)
check("snapshot attribution also server-stamped",
      vv["versions"][0]["adminId"] == "lsadmin", vv["versions"][0]["adminId"])
stop(srv)

print(f"\n{'='*60}\nPASSED {len(passed)}   FAILED {len(failed)}")
for f in failed:
    print("  -", f)
sys.exit(1 if failed else 0)

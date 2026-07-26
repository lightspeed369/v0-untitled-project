#!/usr/bin/env python3
"""Admin login brute-force protection.

Runs its own server because it deliberately exhausts the login allowance.
Distinct clients are simulated with X-Forwarded-For.
"""
import json, os, tempfile, shutil, subprocess, sys, time, urllib.error, urllib.request

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(tempfile.gettempdir(), "lsta-test-rldata")
PORT = 3180
BASE = f"http://localhost:{PORT}"
PASSWORD = "ratelimit-test-pass"

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def login(password, client=None):
    r = urllib.request.Request(BASE + "/api/admin/login", method="POST")
    r.add_header("Content-Type", "application/json")
    if client:
        r.add_header("X-Forwarded-For", client)
    r.data = json.dumps({"password": password}).encode()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.headers


def start():
    env = {**os.environ, "DATA_DIR": DATA, "ADMIN_PASSWORD": PASSWORD,
           "PATH": "/opt/homebrew/bin:" + os.environ.get("PATH", "")}
    p = subprocess.Popen([os.path.join(WORK, "node_modules", ".bin", "next"), "start", "-p", str(PORT)],
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


shutil.rmtree(DATA, ignore_errors=True)
srv = start()

print("\n=== A. FREE ALLOWANCE THEN BACKOFF ===")
codes = [login("wrong", client="10.0.0.1")[0] for _ in range(6)]
check("first 6 wrong guesses answer 401 (5 free + the one that trips it)",
      codes == [401] * 6, f"codes={codes}")
status, headers = login("wrong", client="10.0.0.1")
check("next attempt is refused with 429", status == 429, f"status={status}")
check("429 carries a Retry-After header", headers.get("Retry-After") is not None,
      f"Retry-After={headers.get('Retry-After')}")

print("\n=== B. BLOCKED CLIENTS LEARN NOTHING ===")
status, _ = login(PASSWORD, client="10.0.0.1")
check("even the CORRECT password is refused while blocked (no oracle)", status == 429, f"status={status}")

print("\n=== C. BLOCKING IS PER-CLIENT ===")
status, _ = login("wrong", client="10.0.0.2")
check("a different client still gets its own allowance", status == 401, f"status={status}")
status, _ = login(PASSWORD, client="10.0.0.2")
check("and can still log in successfully", status == 200, f"status={status}")

print("\n=== D. SUCCESS CLEARS HISTORY ===")
for _ in range(4):
    login("wrong", client="10.0.0.3")
status, _ = login(PASSWORD, client="10.0.0.3")
check("login succeeds after 4 failures", status == 200, f"status={status}")
codes = [login("wrong", client="10.0.0.3")[0] for _ in range(6)]
check("allowance was reset by the success", codes == [401] * 6, f"codes={codes}")

print("\n=== E. SPOOFED X-FORWARDED-FOR CANNOT RESET THE LIMIT ===")
# 10.0.0.1 is blocked. A client prepending its own XFF entry must not escape:
# the rightmost value (the one a real proxy appends) is what counts.
status, _ = login("wrong", client="1.2.3.4, 10.0.0.1")
check("prepending a fake IP does not bypass the block", status == 429, f"status={status}")
status, _ = login("wrong", client="10.0.0.1, 1.2.3.4")
check("a genuinely different rightmost IP is treated as a new client",
      status == 401, f"status={status}")

print("\n=== F. PUBLIC CALCULATOR IS UNAFFECTED ===")
with urllib.request.urlopen(BASE + "/api/config", timeout=30) as r:
    check("GET /api/config still 200 while logins are blocked", r.status == 200)

stop(srv)
shutil.rmtree(DATA, ignore_errors=True)

print(f"\n{'='*60}\nPASSED {len(passed)}   FAILED {len(failed)}")
for f in failed:
    print("  -", f)
sys.exit(1 if failed else 0)

#!/bin/sh
# Run every suite against a production build.
#
#   pnpm build && tests/run_all.sh
#
# Each suite starts its own server on its own port with its own temp DATA_DIR, so
# they do not interfere with each other or with any real data.
set -e

cd "$(dirname "$0")/.."

if [ ! -x node_modules/.bin/next ]; then
  echo "Dependencies missing. Run: pnpm install" >&2
  exit 1
fi

if [ ! -d .next ]; then
  echo "No build found. Run: pnpm build" >&2
  exit 1
fi

fail=0
for suite in tests/test_core.py tests/test_resilience.py tests/test_versions.py tests/test_ratelimit.py; do
  echo ""
  echo "################ $suite ################"
  python3 "$suite" || fail=1
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "All suites passed."
else
  echo "One or more suites FAILED." >&2
fi
exit "$fail"

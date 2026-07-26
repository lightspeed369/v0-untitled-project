#!/bin/sh
# Railway mounts volumes as root-owned. Make DATA_DIR writable by the app user,
# then drop privileges. If we're already unprivileged, just run.
set -e

DATA_DIR="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null || \
    echo "[entrypoint] warning: could not chown $DATA_DIR; persistence may be unavailable"
  exec su-exec nextjs "$@"
fi

mkdir -p "$DATA_DIR" 2>/dev/null || true
exec "$@"

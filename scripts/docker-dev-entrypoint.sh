#!/bin/sh
set -e
cd /app

LOCK=package-lock.json
STAMP=node_modules/.docker-install-stamp

if [ ! -f "$LOCK" ]; then
  echo "docker-dev-entrypoint: missing $LOCK; run npm install on the host first." >&2
  exit 1
fi

# Anonymous /app/node_modules volume can outlive dependency changes; refresh when needed.
if [ ! -f "$STAMP" ] || [ "$LOCK" -nt "$STAMP" ] || [ ! -d node_modules/@nestjs/common ]; then
  echo "docker-dev-entrypoint: syncing node_modules (npm ci)..."
  npm ci
  touch "$STAMP"
fi

exec "$@"

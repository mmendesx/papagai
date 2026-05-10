#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete. Starting application..."
exec su-exec papagai node dist/main.js

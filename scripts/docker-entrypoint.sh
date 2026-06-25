#!/bin/sh
set -e

# Garantir que as pastas de dados existam
mkdir -p /app/media /app/instances /app/uploads

# Garantir permissão de escrita para o usuário do app (papagai)
chown -R papagai:papagai /app/media /app/instances /app/uploads

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete. Starting application..."
exec su-exec papagai node dist/main.js

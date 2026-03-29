#!/bin/sh
set -e
npx prisma migrate deploy
WRITE_DB_URL="$READ_DB_URL" npx prisma migrate deploy

if [ "${SETUP_LOGICAL_REPLICATION:-}" = "true" ]; then
  sh ./scripts/setup-logical-replication.sh
fi

exec node dist/server.js

#!/bin/sh
set -e
npx prisma migrate deploy
WRITE_DB_URL="$READ_DB_URL" npx prisma migrate deploy
exec node dist/server.js

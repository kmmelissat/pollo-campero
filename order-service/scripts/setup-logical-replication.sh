#!/bin/sh
# Configura publicación (primaria) y suscripción (réplica) para la tabla `orders`.
# Requiere primaria con wal_level=logical. Idempotente salvo conflictos de slots antiguos.
set -eu

PGUSER="${PGUSER:-pollos}"
PGPASSWORD="${PGPASSWORD:-pollos}"
PRIMARY_HOST="${PG_PRIMARY_HOST:-postgres-primary}"
REPLICA_HOST="${PG_REPLICA_HOST:-postgres-replica}"
DB="${PGDATABASE:-orders}"
PUB_NAME="${LOGICAL_REP_PUBLICATION:-pollos_orders_pub}"
SUB_NAME="${LOGICAL_REP_SUBSCRIPTION:-pollos_orders_sub}"

export PGPASSWORD

echo "[setup-logical-replication] Esperando PostgreSQL en ${PRIMARY_HOST} y ${REPLICA_HOST}..."

i=0
while ! pg_isready -h "$PRIMARY_HOST" -U "$PGUSER" -d "$DB" -q; do
  i=$((i + 1))
  [ "$i" -gt 120 ] && echo "[setup-logical-replication] Timeout primaria" && exit 1
  sleep 1
done

i=0
while ! pg_isready -h "$REPLICA_HOST" -U "$PGUSER" -d "$DB" -q; do
  i=$((i + 1))
  [ "$i" -gt 120 ] && echo "[setup-logical-replication] Timeout réplica" && exit 1
  sleep 1
done

psql -h "$PRIMARY_HOST" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE \"${PGUSER}\" WITH REPLICATION;"

PUB_EXISTS=$(psql -h "$PRIMARY_HOST" -U "$PGUSER" -d "$DB" -Atc \
  "SELECT 1 FROM pg_publication WHERE pubname = '${PUB_NAME}';" || true)
if [ "$PUB_EXISTS" != "1" ]; then
  echo "[setup-logical-replication] Creando publicación ${PUB_NAME}..."
  psql -h "$PRIMARY_HOST" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -c \
    "CREATE PUBLICATION ${PUB_NAME} FOR TABLE orders;"
else
  echo "[setup-logical-replication] Publicación ${PUB_NAME} ya existe."
fi

SUB_EXISTS=$(psql -h "$REPLICA_HOST" -U "$PGUSER" -d "$DB" -Atc \
  "SELECT 1 FROM pg_subscription WHERE subname = '${SUB_NAME}';" || true)
if [ "$SUB_EXISTS" != "1" ]; then
  echo "[setup-logical-replication] Creando suscripción ${SUB_NAME}..."
  CONN="host=${PRIMARY_HOST} port=5432 dbname=${DB} user=${PGUSER} password=${PGPASSWORD}"
  psql -h "$REPLICA_HOST" -U "$PGUSER" -d "$DB" -v ON_ERROR_STOP=1 -c \
    "CREATE SUBSCRIPTION ${SUB_NAME} CONNECTION '${CONN}' PUBLICATION ${PUB_NAME} WITH (copy_data = true);"
else
  echo "[setup-logical-replication] Suscripción ${SUB_NAME} ya existe."
fi

echo "[setup-logical-replication] Listo."

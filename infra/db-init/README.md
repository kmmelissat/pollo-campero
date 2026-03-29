Este directorio documenta la inicialización de PostgreSQL.

Las tablas las crea **Prisma** (`order-service`) con `prisma migrate deploy` al arrancar el contenedor (primero la primaria, luego la réplica).

## Replicación lógica (primaria → réplica)

Con `SETUP_LOGICAL_REPLICATION=true` (Docker Compose y manifiestos Kubernetes), el `order-service` ejecuta `order-service/scripts/setup-logical-replication.sh` tras las migraciones:

1. La **primaria** arranca con `wal_level=logical` (requerido por PostgreSQL para publicaciones).
2. En la primaria: rol con `REPLICATION` y publicación `pollos_orders_pub` sobre la tabla `orders`.
3. En la réplica: suscripción `pollos_orders_sub` que se alimenta de esa publicación.

Así las **escrituras** en la primaria llegan a la **réplica**, y `GET /orders` (lecturas vía `READ_DB_URL`) puede mostrar los mismos datos.

Si cambias la configuración de WAL en una primaria que ya tenía datos en volumen, suele hacer falta recrear el volumen (por ejemplo `docker compose down -v`).

Para desarrollo local con **un solo** Postgres, usa la misma URL en `READ_DB_URL` y `WRITE_DB_URL` y **no** actives `SETUP_LOGICAL_REPLICATION`.

## Migraciones manuales

Desde `backend/order-service`:

```bash
npx prisma migrate deploy
```

Si tienes segunda instancia sin Docker, aplica también allí: `WRITE_DB_URL="$READ_DB_URL" npx prisma migrate deploy`.

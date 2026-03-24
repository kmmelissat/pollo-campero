Este directorio documenta la inicialización de PostgreSQL.

Las tablas las crea **Prisma** (`order-service`) con `prisma migrate deploy` al arrancar el contenedor.

Para desarrollo local sin Docker, ejecuta migraciones desde `backend/order-service`:

```bash
npx prisma migrate deploy
```

Si usas **réplica** sin replicación real, las lecturas en la réplica no verán filas nuevas hasta que exista sincronización. Para pruebas locales puedes apuntar `READ_DB_URL` al mismo host que `WRITE_DB_URL` (ver README principal).

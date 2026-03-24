# Backend — sistema distribuido de pedidos (pollo / delivery)

Monorepo académico con **microservicios** en Node.js, **Express**, **TypeScript**, **PostgreSQL** (primaria + réplica simulada), **RabbitMQ** y **Docker**. Pensado para demostrar comunicación por red, eventos asíncronos y separación lectura/escritura antes de desplegar en **Kubernetes** (manifiestos fuera de alcance por ahora).

## Servicios

| Servicio | Puerto | Rol |
|----------|--------|-----|
| `menu-service` | 3001 | Catálogo en memoria (semilla), validación de productos |
| `order-service` | 3002 | Pedidos: validación vía HTTP al menú, escritura en PostgreSQL primario, lecturas vía `pg` hacia réplica, publicación a RabbitMQ |
| `notification-service` | 3003 | HTTP mínimo + consumidor RabbitMQ con reconexión básica |

## Estructura de carpetas

```
backend/
├── shared/                 # Tipos y constantes compartidos (eventos RabbitMQ)
├── menu-service/
├── order-service/          # Prisma → escrituras; pg → lecturas (READ_DB_URL)
├── notification-service/
├── infra/
│   ├── docker-compose.yml
│   └── db-init/            # Notas de inicialización
├── scripts/
│   └── demo-order-flow.sh
├── api-examples.http
└── README.md
```

## Requisitos

- Node.js 20+
- Docker y Docker Compose (para el stack completo)

## Variables de entorno

Cada servicio incluye un `.env.example`. Resumen:

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `PORT` | todos | Puerto HTTP |
| `NODE_ENV` | todos | `development` \| `production` |
| `MENU_SERVICE_URL` | order-service | URL base del menú (p. ej. `http://localhost:3001`) |
| `RABBITMQ_URL` | order-service, notification-service | AMQP (p. ej. `amqp://guest:guest@localhost:5672`) |
| `WRITE_DB_URL` | order-service | PostgreSQL **primario** (Prisma escrituras) |
| `READ_DB_URL` | order-service | PostgreSQL **réplica** (solo lecturas en `GET /orders`) |

## Cómo correr cada servicio (local, sin Docker)

1. **RabbitMQ y PostgreSQL** deben estar disponibles (o usa Docker Compose solo para infra).

2. **Paquete compartido** (desde `backend/shared`):

   ```bash
   npm install && npm run build
   ```

3. **menu-service**

   ```bash
   cd menu-service
   cp .env.example .env
   npm install && npm run dev
   ```

4. **order-service**

   ```bash
   cd order-service
   cp .env.example .env
   # Ajusta WRITE_DB_URL, READ_DB_URL, MENU_SERVICE_URL, RABBITMQ_URL
   npm install
   npx prisma migrate deploy
   npm run dev
   ```

   Si `READ_DB_URL` apunta a **otra** instancia PostgreSQL, aplica también las migraciones allí (por ejemplo: `WRITE_DB_URL="$READ_DB_URL" npx prisma migrate deploy` en esa misma shell).  
   Para un solo Postgres local, usa la **misma** URL en `READ_DB_URL` y `WRITE_DB_URL` para que `GET /orders` vea los datos.

5. **notification-service**

   ```bash
   cd notification-service
   cp .env.example .env
   npm install && npm run dev
   ```

## Docker Compose (recomendado)

Desde `backend/infra`:

```bash
docker compose up --build
```

- **Menú**: [http://localhost:3001/menu](http://localhost:3001/menu)  
- **Pedidos**: [http://localhost:3002/orders](http://localhost:3002/orders)  
- **RabbitMQ Management**: [http://localhost:15672](http://localhost:15672) (guest/guest)

### Primaria y réplica simulada

Hay dos contenedores PostgreSQL independientes (`postgres-primary`, `postgres-replica`). El `order-service`:

- Escribe con **Prisma** usando `WRITE_DB_URL` (primaria).
- Lee listados y detalle con **`pg`** usando `READ_DB_URL` (réplica).

Al arrancar, el script de entrada del contenedor ejecuta `prisma migrate deploy` **dos veces**: primero contra la primaria y luego contra la réplica, para que **ambas tengan el mismo esquema**.  
**No hay replicación física de datos**: lo insertado en la primaria **no** aparece automáticamente en la réplica. Por eso, en Compose por defecto, `GET /orders` puede devolver una lista vacía mientras la primaria sí tiene filas.

**Opciones académicas defendibles:**

1. Explicar en clase que el **código** separa lectura/escritura y que en producción la réplica estaría sincronizada.  
2. Para una demo local rápida, apuntar `READ_DB_URL` al **mismo** host que la primaria (por ejemplo en un `docker-compose.override.yml`).

## Endpoints

### menu-service

- `GET /health`
- `GET /menu`
- `GET /menu/:id`

### order-service

- `GET /health`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `PATCH /orders/:id/status` — body: `{ "status": "pending" | "confirmed" | ... }`

### notification-service

- `GET /health`

## Formato de respuesta

**Éxito:** `{ "success": true, "data": ... }`  
**Error:** `{ "success": false, "message": "...", "details": ... }` (cuando aplica)

## Eventos RabbitMQ

- Exchange: `orders` (tipo `topic`, durable).
- Routing keys: `order.created`, `order.updated`.
- Payload JSON sugerido (campos): `eventType`, `orderId`, `status`, `timestamp`, `summary`.

## Ejemplo de flujo (crear pedido)

1. El cliente llama `POST /orders` con `customerName` e `items` (`productId`, `quantity`).
2. `order-service` consulta `menu-service` por cada producto (timeout ~5s).
3. Se valida existencia y `available`, se calculan subtotales y total.
4. Se persiste en la **primaria** (Prisma).
5. Se publica `order.created`.
6. `notification-service` consume el mensaje y escribe un bloque de log legible.

Al cambiar estado con `PATCH /orders/:id/status`, se actualiza la primaria y se publica `order.updated`.

## Probar con `.http` o script

- VS Code / IntelliJ: abre `api-examples.http` y ejecuta las peticiones (ajusta UUID tras crear pedido).
- Terminal (requiere `jq`):

  ```bash
  chmod +x scripts/demo-order-flow.sh
  ./scripts/demo-order-flow.sh
  ```

## Stack técnico

- Validación: **Zod**
- ORM / migraciones (escritura): **Prisma**
- Lecturas réplica: **`pg`**
- Mensajería: **amqplib**

## Notas

- No hay frontend ni manifiestos Kubernetes en este repositorio.
- El menú es **semilla en memoria** (`menu-service/src/services/menu-seed.ts`).
- `notification-service` deja un `NotificationDispatcherService` preparado para WebSocket/email sin implementarlos aún.

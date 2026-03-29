# Backend — sistema distribuido de pedidos (pollo / delivery)

Monorepo académico con **microservicios** en Node.js, **Express**, **TypeScript**, **PostgreSQL** (primaria + réplica con **replicación lógica**), **RabbitMQ**, **Docker** y **manifiestos Kubernetes** (`infra/k8s/`). Demuestra comunicación por red, eventos asíncronos, lectura/escritura en instancias distintas y despliegue en clúster.

## Servicios

| Servicio | Puerto | Rol |
|----------|--------|-----|
| `menu-service` | 3001 | Catálogo en memoria (semilla), validación de productos |
| `order-service` | 3002 | Pedidos: validación HTTP al menú, escritura en PostgreSQL primario (Prisma), lecturas en réplica (`pg`), publicación a RabbitMQ; opcionalmente configura publicación/suscripción entre ambas bases |
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
│   ├── k8s/               # Deployments, Services, namespace `pollos`
│   └── db-init/           # Notas de PostgreSQL y replicación
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
| `READ_DB_URL` | order-service | PostgreSQL **réplica** (lecturas `GET /orders`, `GET /orders/:id`) |
| `SETUP_LOGICAL_REPLICATION` | order-service (Docker/K8s) | `true` para crear publicación en primaria y suscripción en réplica al arrancar |
| `PG_PRIMARY_HOST` / `PG_REPLICA_HOST` | order-service | Hostnames DNS internos (por defecto `postgres-primary` / `postgres-replica`) |

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

### Primaria y réplica (replicación lógica)

Hay dos instancias PostgreSQL (`postgres-primary`, `postgres-replica`). El `order-service`:

- Escribe con **Prisma** en `WRITE_DB_URL` (primaria).
- Lee con **`pg`** desde `READ_DB_URL` (réplica).

En **Docker Compose** y **Kubernetes**, `SETUP_LOGICAL_REPLICATION=true` hace que, tras `prisma migrate deploy` en ambas bases, se ejecute `order-service/scripts/setup-logical-replication.sh`:

1. La primaria corre con `wal_level=logical`.
2. Se crea la publicación `pollos_orders_pub` sobre la tabla `orders`.
3. En la réplica se crea la suscripción `pollos_orders_sub` hacia la primaria.

Con eso, los datos escritos en la primaria **se replican** a la réplica y `GET /orders` refleja los pedidos creados con `POST /orders` (tras un breve retardo de replicación).

**Desarrollo local con un solo Postgres:** usa la misma URL en `READ_DB_URL` y `WRITE_DB_URL` y **no** definas `SETUP_LOGICAL_REPLICATION`.

**Si la primaria ya existía sin `wal_level=logical`** en el volumen, recrea los volúmenes (`docker compose down -v`) o el arranque puede fallar al crear la publicación.

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
4. Se persiste en la **primaria** (Prisma); la réplica recibe la fila vía replicación lógica cuando está configurada.
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

- No hay frontend; los manifiestos Kubernetes viven en `infra/k8s/`.
- El menú es **semilla en memoria** (`menu-service/src/services/menu-seed.ts`).
- `notification-service` expone un `NotificationDispatcherService` preparado para WebSocket/email sin implementarlos aún.

## Infraestructura y despliegue (Kubernetes)

### Arquitectura en el clúster

- `menu-service`, `order-service` (**2 réplicas**), `notification-service`
- `postgres-primary` (WAL lógico), `postgres-replica` (suscriptor), `rabbitmq`
- Namespace: `pollos`

### Prerrequisitos

- Docker (o Docker Desktop)
- Minikube (u otro clúster local), `kubectl`
- Node.js 20+ (solo para compilar si ajustas código)

### Pasos (desde `infra/k8s/`)

1. **Iniciar Minikube** (ejemplo):

   ```bash
   minikube start --driver=docker
   kubectl get nodes
   ```

2. **Namespace**

   ```bash
   kubectl apply -f namespace.yaml
   kubectl get ns
   ```

3. **Bases de datos y RabbitMQ**

   ```bash
   kubectl apply -f postgres-primary-deployment.yaml
   kubectl apply -f postgres-primary-service.yaml
   kubectl apply -f postgres-replica-deployment.yaml
   kubectl apply -f postgres-replica-service.yaml
   kubectl apply -f rabbitmq-deployment.yaml
   kubectl apply -f rabbitmq-service.yaml
   ```

4. **Imágenes** (desde la raíz del repo `backend/`):

   ```bash
   docker build -t pollos-menu-service:latest -f menu-service/Dockerfile .
   docker build -t pollos-order-service:latest -f order-service/Dockerfile .
   docker build -t pollos-notification-service:latest -f notification-service/Dockerfile .
   ```

5. **Cargar imágenes en Minikube**

   ```bash
   minikube image load pollos-menu-service:latest
   minikube image load pollos-order-service:latest
   minikube image load pollos-notification-service:latest
   ```

6. **Microservicios**

   ```bash
   kubectl apply -f menu-service-deployment.yaml
   kubectl apply -f menu-service-service.yaml
   kubectl apply -f order-service-deployment.yaml
   kubectl apply -f order-service-service.yaml
   kubectl apply -f notification-service-deployment.yaml
   kubectl apply -f notification-service-service.yaml
   ```

7. **Verificación**

   ```bash
   kubectl get pods,svc,deploy -n pollos
   ```

8. **Exposición externa** (`order-service` es **NodePort** 30002):

   ```bash
   minikube service order-service -n pollos --url
   curl "$(minikube service order-service -n pollos --url)/health"
   ```

### Comunicación entre servicios

Flujo típico: el cliente pega al `order-service` → HTTP a `menu-service` → escritura en `postgres-primary` → replicación lógica hacia `postgres-replica` → lecturas `GET /orders` desde la réplica → evento en RabbitMQ → `notification-service`.

```bash
kubectl logs deployment/order-service -n pollos
kubectl logs deployment/notification-service -n pollos
```

### Resiliencia (réplicas del order-service)

```bash
kubectl delete pod -n pollos -l app=order-service
kubectl get pods -n pollos -w
```

### Prueba rápida de API

```bash
URL=$(minikube service order-service -n pollos --url)
curl -sf "$URL/health"
curl -sf -X POST "$URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Demo","items":[{"productId":1,"quantity":1}]}'
curl -sf "$URL/orders"
```

La lista en `GET /orders` debe incluir el pedido creado (lectura desde la réplica tras replicar).

### Base de datos distribuida

- **Escritura:** `WRITE_DB_URL` → `postgres-primary` (Prisma).
- **Lectura:** `READ_DB_URL` → `postgres-replica` (`pg`).
- **Sincronización:** publicación `pollos_orders_pub` / suscripción `pollos_orders_sub` (script al arrancar `order-service` con `SETUP_LOGICAL_REPLICATION=true`).

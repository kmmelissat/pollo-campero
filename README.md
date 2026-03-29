# Backend — sistema distribuido de pedidos (pollo / delivery)

Monorepo académico con **microservicios** en Node.js, **Express**, **TypeScript**, **PostgreSQL** (primaria + réplica con **replicación lógica**), **RabbitMQ**, **Docker** y **manifiestos Kubernetes** (`infra/k8s/`). Demuestra comunicación por red, eventos asíncronos, lectura/escritura en instancias distintas y despliegue en clúster.

---

## Guía principal: probar con Docker (proyecto final)

Esta es la forma **recomendada** para demostrar el sistema completo en máquina local: varios contenedores, red interna, base de datos “distribuida” (dos instancias + sync lógica), mensajería y API accesible desde el navegador o `curl`.

### Qué queda cubierto frente al enunciado típico

| Requisito | Cómo se ve con Docker Compose |
|-----------|--------------------------------|
| Varios servicios independientes | `menu-service`, `order-service`, `notification-service` + Postgres ×2 + RabbitMQ, cada uno en su contenedor |
| Comunicación por red | HTTP (pedidos ↔ menú), AMQP (pedidos ↔ notificaciones), SQL (pedidos ↔ primaria/réplica) |
| Servicio de entrada (API) | `order-service` en [http://localhost:3002](http://localhost:3002) |
| Servicios de negocio / datos | Menú, notificaciones; datos en `postgres-primary` y `postgres-replica` |
| Red pública (local) | Puertos expuestos al host: 3001, 3002, 3003, 15672 (RabbitMQ UI) |
| Base de datos distribuida (simulada) | Escritura en primaria; lectura en réplica; replicación lógica al arrancar |
| Mensajería entre servicios | Eventos `order.*` vía RabbitMQ |

La **réplica del mismo servicio en Kubernetes** (2 pods de `order-service` + balanceo) se demuestra en la sección [Despliegue en Kubernetes](#despliegue-en-kubernetes-minikube) más abajo.

### Prerrequisitos

- **Docker** y **Docker Compose** (Docker Desktop u equivalente)
- Opcional: **Node.js 20+** solo si compilas o ejecutas servicios fuera de Docker

### Pasos (desde cero)

1. **Ir a la carpeta de infraestructura** (desde la raíz del repo `backend/`):

   ```bash
   cd infra
   ```

2. **Arranque limpio** (obligatorio si ya tenías Postgres sin `wal_level=logical`, o si falló la replicación):

   ```bash
   docker compose down -v
   ```

3. **Levantar todo** (construye imágenes si hace falta):

   ```bash
   docker compose up --build
   ```

   En segundo plano: `docker compose up --build -d` y luego `docker compose logs -f order-service` para ver migraciones y el script de replicación.

4. **Esperar a que los healthchecks pasen** (el `order-service` tarda un poco: migraciones en ambas bases + publicación/suscripción). Comprueba:

   ```bash
   curl -sf http://localhost:3001/health
   curl -sf http://localhost:3002/health
   curl -sf http://localhost:3003/health
   ```

5. **Comunicación interna + API pública** — abre en el navegador o usa `curl`:

   - Menú (catálogo): [http://localhost:3001/menu](http://localhost:3001/menu)
   - Pedidos (API de entrada): [http://localhost:3002/orders](http://localhost:3002/orders)

6. **Demostrar flujo completo** (los `productId` son **strings** del menú, p. ej. `combo-campero`):

   ```bash
   curl -sf -X POST http://localhost:3002/orders \
     -H "Content-Type: application/json" \
     -d '{"customerName":"Demo","items":[{"productId":"combo-campero","quantity":1}]}'
   ```

   Luego **lectura desde la réplica** (el `GET` usa `READ_DB_URL`, no la primaria):

   ```bash
   sleep 2
   curl -sf http://localhost:3002/orders
   ```

   Debes ver el pedido creado en la lista.

7. **Demostrar mensajería** — el `notification-service` consume de RabbitMQ:

   ```bash
   docker logs pollos-notification-service 2>&1 | tail -30
   ```

   También puedes abrir la UI: [http://localhost:15672](http://localhost:15672) (usuario/contraseña `guest` / `guest`).

8. **Parar el stack** (mantiene volúmenes):

   ```bash
   docker compose down
   ```

   Para borrar datos de Postgres: `docker compose down -v`.

### Qué hace el stack respecto a Postgres

- **Primaria** (`postgres-primary`): recibe las **escrituras** (Prisma).
- **Réplica** (`postgres-replica`): sirve las **lecturas** de listados/detalle (`pg`).
- Con `SETUP_LOGICAL_REPLICATION=true` (ya definido en `docker-compose.yml`), al arrancar `order-service` se crean publicación y suscripción lógicas para la tabla `orders`, de modo que los datos **sincronizan** de primaria → réplica.

Si cambias la configuración de WAL en una primaria que ya tenía volumen antiguo, usa `docker compose down -v` antes de volver a subir.

### Otras formas de probar (mismo stack levantado)

- **VS Code / IntelliJ:** archivo `api-examples.http` en la raíz del repo.
- **Script de terminal** (requiere `jq`):

  ```bash
  chmod +x scripts/demo-order-flow.sh
  ./scripts/demo-order-flow.sh
  ```

---

## Despliegue en Kubernetes (Minikube)

Aquí se cumple además: **≥3 Deployments**, **≥3 Services**, **acceso externo** al API (NodePort), **2 réplicas** de `order-service`, misma lógica de primaria/réplica y RabbitMQ.

### Arquitectura en el clúster

- `menu-service`, `order-service` (**2 réplicas**), `notification-service`
- `postgres-primary` (WAL lógico), `postgres-replica` (suscriptor), `rabbitmq`
- Namespace: `pollos`

### Prerrequisitos

- Docker (o Docker Desktop)
- Minikube (u otro clúster local), `kubectl`
- Node.js 20+ (solo si modificas código y reconstruyes imágenes)

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

Flujo típico: cliente → `order-service` → HTTP a `menu-service` → escritura en `postgres-primary` → replicación lógica → `GET /orders` lee la réplica → RabbitMQ → `notification-service`.

```bash
kubectl logs deployment/order-service -n pollos
kubectl logs deployment/notification-service -n pollos
```

### Resiliencia (réplicas del order-service)

```bash
kubectl delete pod -n pollos -l app=order-service
kubectl get pods -n pollos -w
```

### Prueba rápida de API en el clúster

```bash
URL=$(minikube service order-service -n pollos --url)
curl -sf "$URL/health"
curl -sf -X POST "$URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Demo","items":[{"productId":"combo-campero","quantity":1}]}'
curl -sf "$URL/orders"
```

### Base de datos distribuida (manifiestos)

- **Escritura:** `WRITE_DB_URL` → `postgres-primary` (Prisma).
- **Lectura:** `READ_DB_URL` → `postgres-replica` (`pg`).
- **Sincronización:** publicación `pollos_orders_pub` / suscripción `pollos_orders_sub` al arrancar `order-service` con `SETUP_LOGICAL_REPLICATION=true`.

---

## Servicios

| Servicio | Puerto | Rol |
|----------|--------|-----|
| `menu-service` | 3001 | Catálogo en memoria (semilla), validación de productos |
| `order-service` | 3002 | Pedidos: HTTP al menú, escritura en primaria (Prisma), lecturas en réplica (`pg`), RabbitMQ; configura replicación lógica si `SETUP_LOGICAL_REPLICATION=true` |
| `notification-service` | 3003 | HTTP mínimo + consumidor RabbitMQ |

---

## Variables de entorno (referencia)

Cada servicio tiene `.env.example`. Resumen:

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `PORT` | todos | Puerto HTTP |
| `NODE_ENV` | todos | `development` \| `production` |
| `MENU_SERVICE_URL` | order-service | URL base del menú (p. ej. `http://localhost:3001`) |
| `RABBITMQ_URL` | order-service, notification-service | AMQP |
| `WRITE_DB_URL` | order-service | PostgreSQL **primario** (Prisma) |
| `READ_DB_URL` | order-service | PostgreSQL **réplica** (lecturas `GET /orders`) |
| `SETUP_LOGICAL_REPLICATION` | order-service | `true` en Docker/K8s del repo: publicación + suscripción al arrancar |
| `PG_PRIMARY_HOST` / `PG_REPLICA_HOST` | order-service | Hosts DNS internos (por defecto `postgres-primary` / `postgres-replica`) |

En **Docker Compose** estos valores ya vienen definidos; no necesitas `.env` para la demo estándar.

---

## Cómo correr sin Docker (solo desarrollo)

1. Infra: RabbitMQ y PostgreSQL por tu cuenta, o `docker compose` solo con los servicios de datos.
2. **Shared** (desde `backend/shared`):

   ```bash
   npm install && npm run build
   ```

3. **menu-service** — `cd menu-service`, `cp .env.example .env`, `npm install && npm run dev`.
4. **order-service** — `cd order-service`, `cp .env.example .env`, ajusta URLs, `npm install`, `npx prisma migrate deploy`, `npm run dev`.  
   Si usas **dos** Postgres, aplica migraciones también en la réplica (`WRITE_DB_URL="$READ_DB_URL" npx prisma migrate deploy`). Con **un solo** Postgres, usa la misma URL en `READ_DB_URL` y `WRITE_DB_URL` y **no** actives `SETUP_LOGICAL_REPLICATION`.
5. **notification-service** — `cd notification-service`, `cp .env.example .env`, `npm install && npm run dev`.

---

## Estructura de carpetas

```
backend/
├── shared/
├── menu-service/
├── order-service/          # Prisma (escritura); pg (lectura réplica); scripts de replicación
├── notification-service/
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   └── db-init/
├── scripts/
│   └── demo-order-flow.sh
├── api-examples.http
└── README.md
```

---

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

---

## Formato de respuesta

**Éxito:** `{ "success": true, "data": ... }`  
**Error:** `{ "success": false, "message": "...", "details": ... }` (cuando aplica)

---

## Eventos RabbitMQ

- Exchange: `orders` (tipo `topic`, durable).
- Routing keys: `order.created`, `order.updated`.
- Payload sugerido: `eventType`, `orderId`, `status`, `timestamp`, `summary`.

---

## Ejemplo de flujo (crear pedido)

1. `POST /orders` con `customerName` e `items` (`productId` como **string**, `quantity` número).
2. `order-service` consulta `menu-service` por cada producto.
3. Validación, subtotales y total.
4. Persistencia en **primaria**; la réplica recibe la fila vía replicación lógica (Docker/K8s con `SETUP_LOGICAL_REPLICATION`).
5. Publicación `order.created`.
6. `notification-service` consume y registra en log.

Con `PATCH /orders/:id/status` se actualiza la primaria y se publica `order.updated`.

---

## Stack técnico

- Validación: **Zod**
- ORM / migraciones (escritura): **Prisma**
- Lecturas réplica: **`pg`**
- Mensajería: **amqplib**

---

## Notas

- No hay frontend; manifiestos Kubernetes en `infra/k8s/`.
- Menú semilla: `menu-service/src/services/menu-seed.ts`.
- Override opcional: `infra/docker-compose.read-primary.example.yml` (leer desde primaria y desactivar setup de replicación).

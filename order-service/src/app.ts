import express from "express";
import type { PrismaClient } from "@prisma/client";
import type { Pool } from "pg";
import { MenuClient } from "./clients/menu.client";
import { OrderWriteRepository } from "./repositories/order-write.repository";
import { OrderReadRepository } from "./repositories/order-read.repository";
import { RabbitMqPublisherService } from "./services/rabbitmq-publisher.service";
import { OrderService } from "./services/order.service";
import { OrdersController } from "./controllers/orders.controller";
import { ordersRouter } from "./routes/orders.routes";
import { healthRouter } from "./routes/health.routes";
import { errorHandler } from "./middlewares/error-handler";
import type { Env } from "./config/env";

export interface AppDeps {
  env: Env;
  prisma: PrismaClient;
  readPool: Pool;
  rabbit: RabbitMqPublisherService;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());

  const menuClient = new MenuClient(deps.env.MENU_SERVICE_URL);
  const writeRepo = new OrderWriteRepository(deps.prisma);
  const readRepo = new OrderReadRepository(deps.readPool);
  const orderService = new OrderService(
    menuClient,
    writeRepo,
    readRepo,
    deps.rabbit,
  );
  const controller = new OrdersController(orderService);

  app.use("/health", healthRouter());
  app.use("/orders", ordersRouter(controller));

  app.use(errorHandler);
  return app;
}

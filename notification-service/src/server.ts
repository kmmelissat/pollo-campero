import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { NotificationDispatcherService } from "./services/notification-dispatcher.service";
import { OrderEventsConsumer } from "./consumers/order-events.consumer";

const env = loadEnv();
const dispatcher = new NotificationDispatcherService();
const consumer = new OrderEventsConsumer(env.RABBITMQ_URL, dispatcher);

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(
    `[notification-service] HTTP en puerto ${env.PORT} (NODE_ENV=${env.NODE_ENV})`,
  );
  console.log("[notification-service] suscribiendo a RabbitMQ (order.*)...");
});

void consumer.runLoop().catch((e) => {
  console.error("[notification-service] consumidor terminó con error", e);
});

const shutdown = () => {
  console.log("[notification-service] cerrando...");
  consumer.stop();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

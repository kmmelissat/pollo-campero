import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { RabbitMqPublisherService } from "./services/rabbitmq-publisher.service";

const env = loadEnv();
const prisma = new PrismaClient();
const readPool = new Pool({ connectionString: env.READ_DB_URL });
const rabbit = new RabbitMqPublisherService(env.RABBITMQ_URL);

async function main() {
  await rabbit.connect();
  const app = createApp({ env, prisma, readPool, rabbit });
  const server = app.listen(env.PORT, () => {
    console.log(
      `[order-service] listening on port ${env.PORT} (NODE_ENV=${env.NODE_ENV})`,
    );
    console.log(`[order-service] WRITE_DB_URL -> primaria | READ_DB_URL -> réplica`);
  });

  const shutdown = async () => {
    console.log("[order-service] cerrando...");
    server.close();
    await rabbit.close();
    await readPool.end();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("[order-service] error al iniciar", e);
  process.exit(1);
});

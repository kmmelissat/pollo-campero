import amqp from "amqplib";
import {
  ORDERS_EXCHANGE,
  ROUTING_KEYS,
  type OrderEventPayload,
} from "@pollos/shared";
import { z } from "zod";
import type { NotificationDispatcherService } from "../services/notification-dispatcher.service";

const payloadSchema = z.object({
  eventType: z.enum(["order.created", "order.updated"]),
  orderId: z.string(),
  status: z.string(),
  timestamp: z.string(),
  summary: z.string(),
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logEvent(routingKey: string, raw: string, parsed: OrderEventPayload) {
  const line = [
    "========== EVENTO DE PEDIDO ==========",
    `routingKey: ${routingKey}`,
    `raw: ${raw}`,
    `eventType: ${parsed.eventType}`,
    `orderId: ${parsed.orderId}`,
    `status: ${parsed.status}`,
    `timestamp: ${parsed.timestamp}`,
    `summary: ${parsed.summary}`,
    "======================================",
  ].join("\n");
  console.log(line);
}

export class OrderEventsConsumer {
  private stopped = false;

  constructor(
    private readonly url: string,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  stop(): void {
    this.stopped = true;
  }

  /** Bucle con reconexión si RabbitMQ no está listo o se cae la conexión */
  async runLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        const conn = await amqp.connect(this.url);
        conn.on("error", (err) => {
          console.error("[notification-service] error en conexión RabbitMQ:", err);
        });
        const ch = await conn.createChannel();
        await ch.assertExchange(ORDERS_EXCHANGE, "topic", { durable: true });
        const { queue } = await ch.assertQueue("notification-service", {
          durable: true,
        });
        await ch.bindQueue(queue, ORDERS_EXCHANGE, ROUTING_KEYS.ORDER_CREATED);
        await ch.bindQueue(queue, ORDERS_EXCHANGE, ROUTING_KEYS.ORDER_UPDATED);

        await ch.consume(queue, (msg) => {
          if (!msg) return;
          const routingKey = msg.fields.routingKey;
          const raw = msg.content.toString();
          console.log("[notification-service] received order event", {
            routingKey,
            raw,
          });
          try {
            const json: unknown = JSON.parse(raw);
            const parsed = payloadSchema.safeParse(json);
            if (!parsed.success) {
              console.warn(
                "[notification-service] payload inválido, ack para no bloquear:",
                parsed.error.flatten(),
              );
              ch.ack(msg);
              return;
            }
            logEvent(routingKey, raw, parsed.data);
            this.dispatcher.dispatch(parsed.data);
            ch.ack(msg);
          } catch (e) {
            console.error("[notification-service] error procesando mensaje:", e);
            ch.nack(msg, false, false);
          }
        });

        await new Promise<void>((resolve) => {
          conn.on("close", () => resolve());
        });
      } catch (e) {
        if (this.stopped) break;
        console.error(
          "[notification-service] no se pudo conectar a RabbitMQ; reintento en 3s",
          e,
        );
        await sleep(3000);
      }
    }
  }
}

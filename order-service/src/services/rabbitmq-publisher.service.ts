import type { Channel } from "amqplib";
import amqp from "amqplib";
import {
  ORDERS_EXCHANGE,
  ROUTING_KEYS,
  type OrderEventPayload,
} from "@pollos/shared";

export class RabbitMqPublisherService {
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    const conn = await amqp.connect(this.url);
    const ch = await conn.createChannel();
    await ch.assertExchange(ORDERS_EXCHANGE, "topic", { durable: true });
    this.channel = ch;
  }

  async publish(routingKey: string, payload: OrderEventPayload): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not ready");
    }
    const buf = Buffer.from(JSON.stringify(payload));
    this.channel.publish(ORDERS_EXCHANGE, routingKey, buf, {
      persistent: true,
      contentType: "application/json",
    });
  }

  async publishCreated(payload: OrderEventPayload): Promise<void> {
    await this.publish(ROUTING_KEYS.ORDER_CREATED, {
      ...payload,
      eventType: "order.created",
    });
  }

  async publishUpdated(payload: OrderEventPayload): Promise<void> {
    await this.publish(ROUTING_KEYS.ORDER_UPDATED, {
      ...payload,
      eventType: "order.updated",
    });
  }

  async close(): Promise<void> {
    const ch = this.channel;
    this.channel = null;
    if (ch) await ch.close().catch(() => undefined);
  }
}

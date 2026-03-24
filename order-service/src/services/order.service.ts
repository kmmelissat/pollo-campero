import type { MenuClient } from "../clients/menu.client";
import type { OrderWriteRepository } from "../repositories/order-write.repository";
import type { OrderReadRepository } from "../repositories/order-read.repository";
import type { RabbitMqPublisherService } from "./rabbitmq-publisher.service";
import { AppError } from "../utils/app-error";
import { prismaOrderToResponse } from "../utils/order-serialize";
import type { OrderItem, OrderResponse, OrderStatus } from "../models/order";
import { ORDER_STATUSES } from "../models/order";
import { isoNow } from "@pollos/shared";
import { z } from "zod";

const createItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "customerName es requerido"),
  items: z.array(createItemSchema).min(1, "items no puede estar vacío"),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const patchStatusSchema = z.object({
  status: z.enum(
    ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]],
  ),
});

export type PatchOrderStatusDto = z.infer<typeof patchStatusSchema>;

export class OrderService {
  constructor(
    private readonly menu: MenuClient,
    private readonly writeRepo: OrderWriteRepository,
    private readonly readRepo: OrderReadRepository,
    private readonly events: RabbitMqPublisherService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderResponse> {
    const items: OrderItem[] = [];
    for (const line of dto.items) {
      const product = await this.menu.getProduct(line.productId);
      if (!product.available) {
        throw new AppError(
          `El producto "${product.name}" no está disponible`,
          400,
          { productId: product.id },
        );
      }
      const subtotal = Math.round(product.price * line.quantity * 100) / 100;
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: line.quantity,
        subtotal,
      });
    }
    const total =
      Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

    const row = await this.writeRepo.create({
      customerName: dto.customerName,
      items,
      total,
      status: "pending",
    });

    const response = prismaOrderToResponse(row);
    await this.events.publishCreated({
      eventType: "order.created",
      orderId: row.id,
      status: row.status,
      timestamp: isoNow(),
      summary: `Nuevo pedido de ${dto.customerName} por ${items.length} línea(s), total ${total}`,
    });

    return response;
  }

  async list(): Promise<OrderResponse[]> {
    return this.readRepo.list();
  }

  async getById(id: string): Promise<OrderResponse | null> {
    return this.readRepo.getById(id);
  }

  async updateStatus(
    id: string,
    dto: PatchOrderStatusDto,
  ): Promise<OrderResponse> {
    const existing = await this.writeRepo.findById(id);
    if (!existing) {
      throw new AppError("Pedido no encontrado", 404, { id });
    }
    const row = await this.writeRepo.updateStatus(id, dto.status);
    const response = prismaOrderToResponse(row);
    await this.events.publishUpdated({
      eventType: "order.updated",
      orderId: row.id,
      status: row.status,
      timestamp: isoNow(),
      summary: `Pedido ${row.id} pasó a estado "${row.status}"`,
    });
    return response;
  }
}

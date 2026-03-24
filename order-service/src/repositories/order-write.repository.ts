import { Prisma, type PrismaClient } from "@prisma/client";
import type { OrderItem } from "../models/order";

export interface CreateOrderInput {
  customerName: string;
  items: OrderItem[];
  total: number;
  status: string;
}

export class OrderWriteRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateOrderInput) {
    return this.db.order.create({
      data: {
        customerName: input.customerName,
        items: input.items as unknown as Prisma.InputJsonValue,
        total: input.total,
        status: input.status,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.db.order.update({
      where: { id },
      data: { status },
    });
  }

  async findById(id: string) {
    return this.db.order.findUnique({ where: { id } });
  }
}

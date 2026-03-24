import type { Order as PrismaOrder } from "@prisma/client";
import type { OrderItem, OrderResponse } from "../models/order";

function parseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderItem[];
}

export function prismaOrderToResponse(row: PrismaOrder): OrderResponse {
  return {
    id: row.id,
    customerName: row.customerName,
    items: parseItems(row.items),
    total: Number(row.total),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function pgRowToResponse(row: {
  id: string;
  customerName: string;
  items: unknown;
  total: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): OrderResponse {
  return {
    id: row.id,
    customerName: row.customerName,
    items: parseItems(row.items),
    total: Number.parseFloat(row.total),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

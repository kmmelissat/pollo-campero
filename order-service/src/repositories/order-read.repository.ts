import type { Pool } from "pg";
import { pgRowToResponse } from "../utils/order-serialize";
import type { OrderResponse } from "../models/order";

export class OrderReadRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<OrderResponse[]> {
    const { rows } = await this.pool.query<{
      id: string;
      customerName: string;
      items: unknown;
      total: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT id, "customerName", items, total::text, status, "createdAt", "updatedAt"
       FROM orders
       ORDER BY "createdAt" DESC`,
    );
    return rows.map(pgRowToResponse);
  }

  async getById(id: string): Promise<OrderResponse | null> {
    const { rows } = await this.pool.query<{
      id: string;
      customerName: string;
      items: unknown;
      total: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT id, "customerName", items, total::text, status, "createdAt", "updatedAt"
       FROM orders
       WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? pgRowToResponse(row) : null;
  }
}

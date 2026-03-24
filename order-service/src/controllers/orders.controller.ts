import type { Request, Response, NextFunction } from "express";
import { OrderService, createOrderSchema, patchStatusSchema } from "../services/order.service";
import { AppError } from "../utils/app-error";

function paramId(value: string | string[] | undefined): string {
  const id =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value[0]
        : undefined;
  if (!id) throw new AppError("Parámetro id inválido", 400);
  return id;
}

export class OrdersController {
  constructor(private readonly orders: OrderService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("Validación fallida", 400, parsed.error.flatten());
      }
      const data = await this.orders.create(parsed.data);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.orders.list();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramId(req.params.id);
      const row = await this.orders.getById(id);
      if (!row) {
        res.status(404).json({ success: false, message: "Pedido no encontrado" });
        return;
      }
      res.json({ success: true, data: row });
    } catch (e) {
      next(e);
    }
  };

  patchStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramId(req.params.id);
      const parsed = patchStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("Estado inválido", 400, parsed.error.flatten());
      }
      const data = await this.orders.updateStatus(id, parsed.data);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };
}

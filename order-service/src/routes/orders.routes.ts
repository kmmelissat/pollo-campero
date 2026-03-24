import { Router } from "express";
import type { OrdersController } from "../controllers/orders.controller";

export function ordersRouter(controller: OrdersController): Router {
  const r = Router();
  r.post("/", controller.create);
  r.get("/", controller.list);
  r.get("/:id", controller.getById);
  r.patch("/:id/status", controller.patchStatus);
  return r;
}

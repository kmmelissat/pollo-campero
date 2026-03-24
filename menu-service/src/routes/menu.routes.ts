import { Router } from "express";
import type { MenuController } from "../controllers/menu.controller";

export function menuRouter(controller: MenuController): Router {
  const r = Router();
  r.get("/", controller.list);
  r.get("/:id", controller.getById);
  return r;
}

import type { Request, Response, NextFunction } from "express";
import { MenuService } from "../services/menu.service";

export class MenuController {
  constructor(private readonly menu: MenuService) {}

  list = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = this.menu.getAll();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
      if (!id) {
        res.status(400).json({ success: false, message: "id inválido" });
        return;
      }
      const product = this.menu.getById(id);
      if (!product) {
        res.status(404).json({
          success: false,
          message: "Producto no encontrado",
        });
        return;
      }
      res.json({ success: true, data: product });
    } catch (e) {
      next(e);
    }
  };
}

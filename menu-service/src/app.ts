import express from "express";
import { MenuService } from "./services/menu.service";
import { MenuController } from "./controllers/menu.controller";
import { menuRouter } from "./routes/menu.routes";
import { healthRouter } from "./routes/health.routes";
import { errorHandler } from "./middlewares/error-handler";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const menuService = new MenuService();
  const menuController = new MenuController(menuService);

  app.use("/health", healthRouter());
  app.use("/menu", menuRouter(menuController));

  app.use(errorHandler);
  return app;
}

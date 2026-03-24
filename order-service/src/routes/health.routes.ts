import { Router } from "express";

export function healthRouter(): Router {
  const r = Router();
  r.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        service: "order-service",
        note: "Las lecturas de pedidos usan READ_DB_URL (réplica simulada)",
      },
    });
  });
  return r;
}

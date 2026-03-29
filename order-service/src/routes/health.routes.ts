import { Router } from "express";

export function healthRouter(): Router {
  const r = Router();
  r.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        service: "order-service",
        note:
          "Las lecturas de pedidos usan READ_DB_URL (réplica; en Docker/K8s con SETUP_LOGICAL_REPLICATION hay publicación/suscripción hacia la primaria)",
      },
    });
  });
  return r;
}

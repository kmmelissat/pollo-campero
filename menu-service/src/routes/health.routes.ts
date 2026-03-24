import { Router } from "express";

export function healthRouter(): Router {
  const r = Router();
  r.get("/", (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", service: "menu-service" },
    });
  });
  return r;
}

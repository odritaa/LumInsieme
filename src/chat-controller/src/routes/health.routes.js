import { Router } from "express";
import cacheClient from "../cache-client.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const status = { status: "ok", cache: "unknown" };
  try {
    const health = await cacheClient.health();
    status.cache = health.redis_connected ? "ok" : "error";
    if (!health.redis_connected) status.status = "degraded";
  } catch {
    status.cache = "error";
    status.status = "degraded";
  }
  res.json(status);
});

export default router;
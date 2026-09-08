import { Router } from "express";
import redis from "../database.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const status = { status: "ok", redis: "unknown" };
  try {
    const pong = await redis.ping();
    status.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    status.redis = "error";
    status.status = "degraded";
  }
  res.json(status);
});

export default router;
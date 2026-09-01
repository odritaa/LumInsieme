import { Router } from "express";
import { ping } from "../database.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const status = { status: "ok", db: "unknown" };
    try {
      await ping();
      status.db = "ok";
    } catch {
      status.db = "error";
      status.status = "degraded";
    }
    res.status(status.status === "ok" ? 200 : 503).json(status);
  })
);

export default router;

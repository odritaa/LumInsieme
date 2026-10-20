import { Router } from "express";
import * as cacheClient from "../clients/cacheClient.js";
import { ping } from "../database.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// La cartelera es secundaria: sin cache el servicio queda "degraded" pero sigue sirviendo salas.
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const status = { status: "ok", db: "unknown", cache: "unknown" };
    try {
      await ping();
      status.db = "ok";
    } catch {
      status.db = "error";
    }
    try {
      status.cache = (await cacheClient.health()) ? "ok" : "error";
    } catch {
      status.cache = "error";
    }
    if (status.db !== "ok") status.status = "error";
    else if (status.cache !== "ok") status.status = "degraded";
    res.status(status.db === "ok" ? 200 : 503).json(status);
  })
);

export default router;

import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import asyncHandler from "../utils/asyncHandler.js";
import * as salasController from "../controllers/salas.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(salasController.list));
router.post("/", asyncHandler(salasController.create));
router.get("/:id", asyncHandler(salasController.getOne));
router.post("/:id/miembros", asyncHandler(salasController.join));
router.delete("/:id/miembros/me", asyncHandler(salasController.leave));
router.post("/:id/chat-ticket", asyncHandler(salasController.chatTicket));

export default router;

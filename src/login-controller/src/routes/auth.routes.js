import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import asyncHandler from "../utils/asyncHandler.js";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

router.get("/google", authController.startGoogleLogin);
router.get("/google/callback", asyncHandler(authController.handleGoogleCallback));
router.post("/logout", authController.logout);

router.get("/me", requireAuth, asyncHandler(authController.getMe));
router.patch("/me", requireAuth, asyncHandler(authController.updateMe));
router.delete("/me", requireAuth, asyncHandler(authController.deleteMe));

export default router;

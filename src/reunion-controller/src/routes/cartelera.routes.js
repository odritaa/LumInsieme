import { Router } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import * as carteleraController from "../controllers/cartelera.controller.js";

const router = Router();

router.get("/", asyncHandler(carteleraController.getDay));
router.get("/peliculas", asyncHandler(carteleraController.listMovies));

export default router;

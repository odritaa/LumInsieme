import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config.js";
import errorHandler from "./middlewares/errorHandler.js";
import carteleraRoutes from "./routes/cartelera.routes.js";
import healthRoutes from "./routes/health.routes.js";
import salasRoutes from "./routes/salas.routes.js";

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use("/", healthRoutes);
app.use("/cartelera", carteleraRoutes);
app.use("/salas", salasRoutes);

app.use(errorHandler);

export default app;

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config.js";
import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use("/", healthRoutes);
app.use("/auth", authRoutes);

app.use(errorHandler);

export default app;

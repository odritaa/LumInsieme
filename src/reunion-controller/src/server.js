import http from "node:http";
import app from "./app.js";
import config from "./config.js";
import pool from "./database.js";
import { migrate } from "./migrations.js";

try {
  await migrate();
} catch (error) {
  console.error("[reunion] no se pudo aplicar el esquema:", error.message);
  process.exit(1);
}

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`[reunion] escuchando en http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[reunion] ${signal} recibido, cerrando`);
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

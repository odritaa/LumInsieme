import http from "node:http";
import app from "./app.js";
import config from "./config.js";
import pool from "./database.js";

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`[login] escuchando en http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[login] ${signal} recibido, cerrando`);
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

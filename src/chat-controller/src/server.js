import http from "node:http";
import { WebSocketServer } from "ws";
import { URL } from "node:url";
import app from "./app.js";
import { verifyChatTicket } from "./auth.js";
import cacheClient from "./cache-client.js";
import ChatMessage from "./models/ChatMessage.js";
import WsMessage from "./models/WsMessage.js";
import "dotenv/config";

const port = Number(process.env.PORT ?? 3000);
const HISTORY_LIMIT = 50;
const MAX_CONTENT_LENGTH = 1000;

const clients = new Map();

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

wss.on("connection", (socket, req) => {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const ticket = searchParams.get("ticket");

  let identity;
  try {
    identity = verifyChatTicket(ticket ?? "");
  } catch {
    socket.close(4401, "invalid ticket");
    return;
  }
  const { userId, username, eventId } = identity;

  if (!clients.has(eventId)) {
    clients.set(eventId, new Set());
  }
  clients.get(eventId).add(socket);

  console.log(`[ws] ${username} se unió al chat del evento ${eventId}`);

  sendHistory(socket, eventId);

  socket.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (typeof data.content !== "string") return;
      const content = data.content.trim();
      if (!content || content.length > MAX_CONTENT_LENGTH) return;

      const message = new ChatMessage(userId, username, content);
      saveAndBroadcast(eventId, message);
    } catch {
      console.warn("[ws] mensaje no es JSON válido");
    }
  });

  socket.on("close", () => {
    const room = clients.get(eventId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) clients.delete(eventId);
    }
    console.log(`[ws] ${username} se desconectó del chat ${eventId}`);
  });

  socket.on("error", (error) => {
    console.error(`[ws] error de ${username}:`, error.message);
  });
});

async function sendHistory(socket, eventId) {
  try {
    const raw = await cacheClient.range(`chat:${eventId}`, -HISTORY_LIMIT, -1);
    const messages = raw.map((m) => ChatMessage.fromJSON(JSON.parse(m)));
    socket.send(JSON.stringify(WsMessage.history(messages).toJSON()));
  } catch (err) {
    console.warn(`[cache-client] no se pudo obtener historial del evento ${eventId}:`, err.message);
  }
}

async function saveAndBroadcast(eventId, message) {
  try {
    cacheClient.enqueue(eventId, JSON.stringify(message.toJSON()));
  } catch {
    console.warn("[cache-client] no se pudo encolar el mensaje");
  }

  const payload = WsMessage.broadcast(message);
  const room = clients.get(eventId);
  if (!room) return;

  for (const client of room) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload.toJSON()));
    }
  }
}

server.listen(port, async () => {
  console.log(`[server] escuchando en http://localhost:${port}`);
  try {
    const health = await cacheClient.health();
    console.log(`[cache-client] health: ${health.status} (redis: ${health.redis_connected})`);
  } catch (error) {
    console.warn("[cache-client] sin conexión, el chat correrá en modo degradado:", error.message);
  }
});

const shutdown = async () => {
  console.log("\n[server] cerrando...");
  await cacheClient.flushAll();
  wss.close();
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server };

import { once } from "node:events";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import cacheClient from "../src/cache-client.js";
import { server } from "../src/server.js";

vi.mock("../src/cache-client.js", () => ({
  default: {
    range: vi.fn(async () => []),
    enqueue: vi.fn(),
    health: vi.fn(async () => ({ status: "healthy", redis_connected: true })),
    flushAll: vi.fn(),
  },
}));

const SECRET = process.env.JWT_SECRET;
let url;

beforeAll(async () => {
  if (!server.listening) await once(server, "listening");
  url = `ws://127.0.0.1:${server.address().port}/ws/chat`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.mocked(cacheClient.range).mockReset().mockResolvedValue([]);
  vi.mocked(cacheClient.enqueue).mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function chatTicket({ sub = "user-1", name = "Ana", sala = "sala-1", ...options } = {}) {
  return jwt.sign({ name, sala }, options.secret ?? SECRET, {
    subject: sub,
    issuer: options.issuer ?? "luminsieme-reunion-controller",
    audience: options.audience ?? "luminsieme-chat",
    expiresIn: options.expiresIn ?? "5m",
    algorithm: "HS256",
  });
}

// Conecta y junta los frames recibidos; resuelve cuando llega el history.
async function connect(ticket) {
  const socket = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
  const frames = [];
  socket.on("message", (raw) => frames.push(JSON.parse(raw.toString())));
  await once(socket, "open");
  await vi.waitFor(() => expect(frames.some((f) => f.type === "history")).toBe(true));
  return { socket, frames, messages: () => frames.filter((f) => f.type === "message") };
}

async function closeCode(ticketQuery) {
  const socket = new WebSocket(`${url}${ticketQuery}`);
  const [code, reason] = await once(socket, "close");
  return { code, reason: reason.toString() };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("CU-05 Coordinacion — autenticacion del WebSocket", () => {
  it("PT-CU05-04 WebSocket con ticket inválido → cierre 4401 'invalid ticket'", async () => {
    expect(await closeCode("?ticket=basura")).toEqual({ code: 4401, reason: "invalid ticket" });
  });

  it("PT-CU05-05 WebSocket sin ticket → cierre 4401", async () => {
    expect((await closeCode("")).code).toBe(4401);
  });

  it("PT-CU05-06 WebSocket con ticket firmado con otro secreto → cierre 4401", async () => {
    const forged = chatTicket({ secret: "otro-secreto-de-al-menos-32-caracteres!!" });
    expect((await closeCode(`?ticket=${forged}`)).code).toBe(4401);
  });

  it("PT-CU05-07 WebSocket con ticket vencido → cierre 4401", async () => {
    expect((await closeCode(`?ticket=${chatTicket({ expiresIn: -5 })}`)).code).toBe(4401);
  });

  it("PT-CU05-08 WebSocket con el JWT de sesión (aud luminsieme) en lugar del ticket → cierre 4401", async () => {
    const session = chatTicket({ issuer: "luminsieme-login-controller", audience: "luminsieme" });
    expect((await closeCode(`?ticket=${session}`)).code).toBe(4401);
  });
});

describe("CU-05 Coordinacion — historial y difusion", () => {
  it("PT-CU05-09 Al conectar → frame history con los últimos 50 mensajes de chat:<sala>", async () => {
    const stored = [
      { userId: "u2", username: "Bruno", content: "hola", timestamp: 1 },
      { userId: "u3", username: "Caro", content: "¿a qué hora?", timestamp: 2 },
    ];
    vi.mocked(cacheClient.range).mockResolvedValue(stored.map((m) => JSON.stringify(m)));
    const { socket, frames } = await connect(chatTicket({ sala: "sala-historial" }));
    expect(cacheClient.range).toHaveBeenCalledWith("chat:sala-historial", -50, -1);
    expect(frames[0]).toEqual({ type: "history", payload: stored });
    socket.close();
  });

  it("PT-CU05-10 Caché caída al pedir historial → sin history, pero el socket sigue abierto y difunde", async () => {
    vi.mocked(cacheClient.range).mockRejectedValue(new Error("UNAVAILABLE"));
    const socket = new WebSocket(`${url}?ticket=${chatTicket({ sala: "sala-degradada" })}`);
    const frames = [];
    socket.on("message", (raw) => frames.push(JSON.parse(raw.toString())));
    await once(socket, "open");
    socket.send(JSON.stringify({ content: "sin historial" }));
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    expect(frames[0]).toMatchObject({ type: "message", payload: { content: "sin historial" } });
    socket.close();
  });

  it("PT-CU05-11 Mensaje de un miembro → broadcast a todos los miembros de la sala y a nadie más", async () => {
    const ana = await connect(chatTicket({ sub: "ana", name: "Ana", sala: "sala-a" }));
    const bruno = await connect(chatTicket({ sub: "bruno", name: "Bruno", sala: "sala-a" }));
    const ajeno = await connect(chatTicket({ sub: "zoe", name: "Zoe", sala: "sala-b" }));

    ana.socket.send(JSON.stringify({ content: "  ¿Nos vemos 20:15 en la puerta?  " }));
    await vi.waitFor(() => expect(bruno.messages()).toHaveLength(1));
    await vi.waitFor(() => expect(ana.messages()).toHaveLength(1));
    await pause(100);

    expect(bruno.messages()[0].payload).toMatchObject({ userId: "ana", username: "Ana", content: "¿Nos vemos 20:15 en la puerta?" });
    expect(typeof bruno.messages()[0].payload.timestamp).toBe("number");
    expect(ajeno.messages()).toHaveLength(0);
    expect(cacheClient.enqueue).toHaveBeenCalledWith("sala-a", expect.stringContaining("Nos vemos"));
    [ana, bruno, ajeno].forEach((c) => c.socket.close());
  });

  it("PT-CU05-12 La identidad sale del ticket: userId/username enviados por el cliente se ignoran", async () => {
    const ana = await connect(chatTicket({ sub: "ana", name: "Ana", sala: "sala-id" }));
    ana.socket.send(JSON.stringify({ content: "soy otro", userId: "admin", username: "Administrador" }));
    await vi.waitFor(() => expect(ana.messages()).toHaveLength(1));
    expect(ana.messages()[0].payload).toMatchObject({ userId: "ana", username: "Ana" });
    ana.socket.close();
  });

  it("PT-CU05-13 Mensaje vacío o solo espacios → descartado (sin broadcast ni persistencia)", async () => {
    const ana = await connect(chatTicket({ sala: "sala-vacio" }));
    ana.socket.send(JSON.stringify({ content: "" }));
    ana.socket.send(JSON.stringify({ content: "    " }));
    ana.socket.send(JSON.stringify({ content: 42 }));
    await pause(200);
    expect(ana.messages()).toHaveLength(0);
    expect(cacheClient.enqueue).not.toHaveBeenCalled();
    ana.socket.close();
  });

  it("PT-CU05-14 Mensajes de 1001 y de 1000 caracteres → el de 1001 se descarta y el de 1000 se difunde", async () => {
    const ana = await connect(chatTicket({ sala: "sala-largo" }));
    ana.socket.send(JSON.stringify({ content: "x".repeat(1001) }));
    ana.socket.send(JSON.stringify({ content: "y".repeat(1000) }));
    await vi.waitFor(() => expect(ana.messages()).toHaveLength(1));
    await pause(100);
    expect(ana.messages()[0].payload.content).toBe("y".repeat(1000));
    ana.socket.close();
  });

  it("PT-CU05-15 Frame que no es JSON → ignorado sin cerrar la conexión", async () => {
    const ana = await connect(chatTicket({ sala: "sala-json" }));
    ana.socket.send("esto no es json");
    ana.socket.send(JSON.stringify({ content: "sigo conectada" }));
    await vi.waitFor(() => expect(ana.messages()).toHaveLength(1));
    expect(ana.socket.readyState).toBe(WebSocket.OPEN);
    ana.socket.close();
  });
});

describe("Transversal — salud del chat-controller", () => {
  it("PT-TR-03 GET /health con Redis conectado → {status: ok, cache: ok}", async () => {
    const res = await request(server).get("/health");
    expect(res.body).toEqual({ status: "ok", cache: "ok" });
  });

  it("PT-TR-04 GET /health con el cache-controller caído → {status: degraded, cache: error}", async () => {
    vi.mocked(cacheClient.health).mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const res = await request(server).get("/health");
    expect(res.body).toEqual({ status: "degraded", cache: "error" });
  });
});

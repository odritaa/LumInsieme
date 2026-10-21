import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import pool, { query } from "../src/database.js";
import { today } from "../src/services/cartelera.service.js";
import { addDays, addMember, createUser, insertSala, sessionCookie, tomorrow, validSala } from "./helpers.js";

afterAll(() => pool.end());

const post = (user, body) => request(app).post("/salas").set("Cookie", sessionCookie(user)).send(body);
const join = (user, id) => request(app).post(`/salas/${id}/miembros`).set("Cookie", sessionCookie(user));
const leave = (user, id) => request(app).delete(`/salas/${id}/miembros/me`).set("Cookie", sessionCookie(user));
const ticket = (user, id) => request(app).post(`/salas/${id}/chat-ticket`).set("Cookie", sessionCookie(user));

describe("CU-02 Creacion de sala — validaciones", () => {
  let host;
  beforeEach(async () => {
    host = await createUser("Anfitriona");
  });

  it.each([
    ["PT-CU02-01", "cupo 1", { capacity: 1 }, /capacity/],
    ["PT-CU02-02", "cupo 7", { capacity: 7 }, /capacity/],
    ["PT-CU02-03", "cupo no entero (3.5)", { capacity: 3.5 }, /capacity/],
    ["PT-CU02-04", "fecha pasada (ayer)", { date: addDays(today(), -1) }, /pasado/],
    ["PT-CU02-05", "fecha inexistente (2026-02-30)", { date: "2026-02-30" }, /date/],
    ["PT-CU02-06", "hora inválida (25:00)", { time: "25:00" }, /time/],
    ["PT-CU02-07", "hora sin formato HH:MM (8:5)", { time: "8:5" }, /time/],
    ["PT-CU02-08", "película de 121 caracteres", { movie: "x".repeat(121) }, /movie/],
    ["PT-CU02-09", "cine de 121 caracteres", { place: "x".repeat(121) }, /place/],
    ["PT-CU02-10", "nota de 501 caracteres", { note: "x".repeat(501) }, /note/],
    ["PT-CU02-11", "película vacía", { movie: "   " }, /movie/],
  ])("%s POST /salas con %s → 400 invalid_sala", async (_id, _desc, override, detail) => {
    const res = await post(host, validSala(override));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_sala");
    expect(res.body.details.join()).toMatch(detail);
  });

  it("PT-CU02-12 POST /salas con un arreglo como cuerpo → 400 invalid_sala", async () => {
    const res = await post(host, [validSala()]);
    expect(res.status).toBe(400);
  });

  it("PT-CU02-13 POST /salas sin sesión → 401", async () => {
    const res = await request(app).post("/salas").send(validSala());
    expect(res.status).toBe(401);
  });
});

describe("CU-02 Creacion de sala — alta correcta", () => {
  it("PT-CU02-14 POST /salas válido → 201, el creador queda como miembro y anfitrión", async () => {
    const host = await createUser("Ana");
    const res = await post(host, validSala({ movie: "  Nueve Reinas  " }));
    expect(res.status).toBe(201);
    const { sala } = res.body;
    expect(sala).toMatchObject({ movie: "Nueve Reinas", hostId: host.id, host: "Ana", capacity: 4, time: "20:30" });
    expect(sala.members).toEqual([{ id: host.id, name: "Ana", genres: ["Drama"], isAdmin: true }]);
    const { rows } = await query("SELECT user_id FROM sala_miembros WHERE sala_id = $1", [sala.id]);
    expect(rows).toEqual([{ user_id: host.id }]);
  });

  it.each([
    ["PT-CU02-15", 2],
    ["PT-CU02-16", 6],
  ])("%s POST /salas con cupo límite %i → 201", async (_id, capacity) => {
    const res = await post(await createUser(), validSala({ capacity }));
    expect(res.status).toBe(201);
  });

  it("PT-CU02-17 POST /salas con fecha de hoy → 201", async () => {
    const res = await post(await createUser(), validSala({ date: today() }));
    expect(res.status).toBe(201);
  });

  it("PT-CU02-18 La sala no expone email de los miembros → solo id, name, genres, isAdmin", async () => {
    const res = await post(await createUser(), validSala());
    expect(Object.keys(res.body.sala.members[0]).sort()).toEqual(["genres", "id", "isAdmin", "name"]);
  });
});

describe("CU-03 Exploracion del feed de salas", () => {
  beforeEach(async () => {
    await query("TRUNCATE salas CASCADE");
  });

  it("PT-CU03-01 GET /salas sin sesión → 401 unauthenticated", async () => {
    const res = await request(app).get("/salas");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthenticated");
  });

  it("PT-CU03-02 GET /salas con JWT inválido → 401 invalid_token", async () => {
    const res = await request(app).get("/salas").set("Cookie", "lum_session=basura");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_token");
  });

  it("PT-CU03-03 GET /salas → ordenado por created_at DESC (no por fecha de la función)", async () => {
    const host = await createUser();
    const vieja = await insertSala(host, { createdAt: "2026-01-01T10:00:00Z", date: addDays(today(), 1), movie: "Vieja" });
    const nueva = await insertSala(host, { createdAt: "2026-01-03T10:00:00Z", date: addDays(today(), 5), movie: "Nueva" });
    const media = await insertSala(host, { createdAt: "2026-01-02T10:00:00Z", date: addDays(today(), 3), movie: "Media" });
    const res = await request(app).get("/salas").set("Cookie", sessionCookie(host));
    expect(res.status).toBe(200);
    expect(res.body.salas.map((s) => s.id)).toEqual([nueva, media, vieja]);
  });

  it("PT-CU03-04 GET /salas → oculta salas vencidas (fecha anterior a hoy) y muestra las de hoy", async () => {
    const host = await createUser();
    const vencida = await insertSala(host, { date: addDays(today(), -1) });
    const deHoy = await insertSala(host, { date: today() });
    const res = await request(app).get("/salas").set("Cookie", sessionCookie(host));
    const ids = res.body.salas.map((s) => s.id);
    expect(ids).toContain(deHoy);
    expect(ids).not.toContain(vencida);
  });

  it("PT-CU03-05 GET /salas/:id con id mal formado → 404 sala_not_found", async () => {
    const user = await createUser();
    const res = await request(app).get("/salas/123").set("Cookie", sessionCookie(user));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("sala_not_found");
  });

  it("PT-CU03-06 GET /salas/:id inexistente → 404 sala_not_found", async () => {
    const user = await createUser();
    const res = await request(app)
      .get("/salas/00000000-0000-4000-8000-000000000000")
      .set("Cookie", sessionCookie(user));
    expect(res.status).toBe(404);
  });

  it("PT-CU03-07 GET /salas/:id existente → 200 con miembros", async () => {
    const host = await createUser("Host");
    const id = await insertSala(host);
    const res = await request(app).get(`/salas/${id}`).set("Cookie", sessionCookie(host));
    expect(res.status).toBe(200);
    expect(res.body.sala.members[0].name).toBe("Host");
  });
});

describe("CU-04 Incorporacion a una sala", () => {
  it("PT-CU04-01 POST /salas/:id/miembros → 200 y el usuario figura como miembro", async () => {
    const host = await createUser();
    const guest = await createUser("Invitado");
    const id = await insertSala(host);
    const res = await join(guest, id);
    expect(res.status).toBe(200);
    expect(res.body.sala.members.map((m) => m.id)).toEqual([host.id, guest.id]);
    expect(res.body.sala.members[1].isAdmin).toBe(false);
  });

  it("PT-CU04-02 Unirse dos veces a la misma sala → 200 ambas, una sola membresía (idempotente)", async () => {
    const host = await createUser();
    const guest = await createUser();
    const id = await insertSala(host);
    expect((await join(guest, id)).status).toBe(200);
    const again = await join(guest, id);
    expect(again.status).toBe(200);
    expect(again.body.sala.members).toHaveLength(2);
  });

  it("PT-CU04-03 Unirse a una sala completa → 409 sala_full", async () => {
    const host = await createUser();
    const id = await insertSala(host, { capacity: 2 });
    await join(await createUser(), id);
    const res = await join(await createUser(), id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("sala_full");
  });

  it("PT-CU04-04 Un miembro de una sala completa vuelve a unirse → 200 (no 409)", async () => {
    const host = await createUser();
    const id = await insertSala(host, { capacity: 2 });
    const guest = await createUser();
    await join(guest, id);
    expect((await join(guest, id)).status).toBe(200);
  });

  it("PT-CU04-05 Unirse a una sala vencida → 409 sala_closed", async () => {
    const host = await createUser();
    const id = await insertSala(host, { date: addDays(today(), -1) });
    const res = await join(await createUser(), id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("sala_closed");
  });

  it("PT-CU04-06 Unirse a una sala inexistente → 404 sala_not_found", async () => {
    const res = await join(await createUser(), "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("PT-CU04-07 Dos altas concurrentes por el último lugar (20 repeticiones) → una 200 y una 409 sala_full", async () => {
    for (let round = 0; round < 20; round++) {
      const host = await createUser();
      const id = await insertSala(host, { capacity: 2 });
      const [a, b] = await Promise.all([join(await createUser(), id), join(await createUser(), id)]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect([a, b].find((r) => r.status === 409).body.error).toBe("sala_full");
      const { rows } = await query("SELECT count(*)::int AS n FROM sala_miembros WHERE sala_id = $1", [id]);
      expect(rows[0].n).toBe(2);
    }
  });

  it("PT-CU04-08 Ocho altas concurrentes en una sala de cupo 6 → 5 aceptadas, 3 rechazadas, nunca sobrecupo", async () => {
    const host = await createUser();
    const id = await insertSala(host, { capacity: 6 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser()));
    const results = await Promise.all(users.map((u) => join(u, id)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    const { rows } = await query("SELECT count(*)::int AS n FROM sala_miembros WHERE sala_id = $1", [id]);
    expect(rows[0].n).toBe(6);
  });
});

describe("CU-05 Coordinacion — emision del ticket de chat", () => {
  it("PT-CU05-01 POST /salas/:id/chat-ticket de un no miembro → 403 not_a_member", async () => {
    const id = await insertSala(await createUser());
    const res = await ticket(await createUser(), id);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_a_member");
  });

  it("PT-CU05-02 POST /salas/:id/chat-ticket de un miembro → 200 con ticket (aud luminsieme-chat, 5 min)", async () => {
    const host = await createUser("Ana");
    const id = await insertSala(host);
    const res = await ticket(host, id);
    expect(res.status).toBe(200);
    const claims = jwt.verify(res.body.ticket, process.env.JWT_SECRET, {
      audience: "luminsieme-chat",
      issuer: "luminsieme-reunion-controller",
    });
    expect(claims).toMatchObject({ sub: host.id, sala: id, name: "Ana" });
    expect(claims.exp - claims.iat).toBe(300);
  });

  it("PT-CU05-03 POST /salas/:id/chat-ticket sin sesión → 401", async () => {
    const id = await insertSala(await createUser());
    const res = await request(app).post(`/salas/${id}/chat-ticket`);
    expect(res.status).toBe(401);
  });
});

describe("CU-06 Abandono de una sala", () => {
  it("PT-CU06-01 DELETE /salas/:id/miembros/me → 200 y el usuario deja de ser miembro", async () => {
    const host = await createUser();
    const guest = await createUser();
    const id = await insertSala(host);
    await join(guest, id);
    const res = await leave(guest, id);
    expect(res.status).toBe(200);
    expect(res.body.sala.members.map((m) => m.id)).toEqual([host.id]);
  });

  it("PT-CU06-02 El anfitrión abandona → la sala pasa al miembro más antiguo", async () => {
    const host = await createUser("Host");
    const id = await insertSala(host);
    const nuevo = await createUser("Nuevo");
    const antiguo = await createUser("Antiguo");
    await addMember(id, nuevo, "2026-01-02T10:00:00Z");
    await addMember(id, antiguo, "2026-01-01T10:00:00Z");
    const res = await leave(host, id);
    expect(res.status).toBe(200);
    expect(res.body.sala.hostId).toBe(antiguo.id);
    expect(res.body.sala.host).toBe("Antiguo");
    expect(res.body.sala.members.find((m) => m.isAdmin).id).toBe(antiguo.id);
  });

  it("PT-CU06-03 El último miembro abandona → sala eliminada ({sala: null} y luego 404)", async () => {
    const host = await createUser();
    const id = await insertSala(host);
    const res = await leave(host, id);
    expect(res.status).toBe(200);
    expect(res.body.sala).toBeNull();
    const get = await request(app).get(`/salas/${id}`).set("Cookie", sessionCookie(host));
    expect(get.status).toBe(404);
  });

  it("PT-CU06-04 Ticket de chat pedido después de salir → 403 not_a_member", async () => {
    const host = await createUser();
    const guest = await createUser();
    const id = await insertSala(host);
    await join(guest, id);
    expect((await ticket(guest, id)).status).toBe(200);
    await leave(guest, id);
    const res = await ticket(guest, id);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_a_member");
  });

  it("PT-CU06-05 Abandonar una sala inexistente → 404 sala_not_found", async () => {
    const res = await leave(await createUser(), "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("PT-CU06-06 Tras salir, el usuario puede volver a unirse si hay lugar → 200", async () => {
    const host = await createUser();
    const guest = await createUser();
    const id = await insertSala(host, { date: tomorrow() });
    await join(guest, id);
    await leave(guest, id);
    expect((await join(guest, id)).status).toBe(200);
  });
});

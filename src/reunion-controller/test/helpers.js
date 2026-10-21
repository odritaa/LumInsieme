import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "../src/database.js";
import { today } from "../src/services/cartelera.service.js";

export async function createUser(name = "Usuario Test", genres = ["Drama"]) {
  const id = crypto.randomUUID();
  await query("INSERT INTO users (id, google_sub, email, name, genres) VALUES ($1, $2, $3, $4, $5)", [
    id,
    `google-${id}`,
    `${id}@luminsieme.test`,
    name,
    genres,
  ]);
  return { id, name, email: `${id}@luminsieme.test` };
}

export function sessionCookie(user) {
  const token = jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, {
    subject: user.id,
    issuer: "luminsieme-login-controller",
    audience: "luminsieme",
    expiresIn: "1h",
    algorithm: "HS256",
  });
  return `lum_session=${token}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const tomorrow = () => addDays(today(), 1);

export const validSala = (overrides = {}) => ({
  movie: "Dune: Parte Tres",
  place: "Multiplex Belgrano",
  date: tomorrow(),
  time: "20:30",
  capacity: 4,
  note: "Nos vemos en el hall",
  ...overrides,
});

// Inserta directo en la base: permite salas vencidas y created_at controlado, que la API no deja crear.
export async function insertSala(host, { date = tomorrow(), capacity = 4, createdAt = null, movie = "Sala directa" } = {}) {
  const { rows } = await query(
    `INSERT INTO salas (host_id, movie, place, date, time, capacity, created_at)
     VALUES ($1, $2, 'Cine', $3, '20:00', $4, COALESCE($5::timestamptz, now())) RETURNING id`,
    [host.id, movie, date, capacity, createdAt]
  );
  await query("INSERT INTO sala_miembros (sala_id, user_id) VALUES ($1, $2)", [rows[0].id, host.id]);
  return rows[0].id;
}

export async function addMember(salaId, user, joinedAt) {
  await query("INSERT INTO sala_miembros (sala_id, user_id, joined_at) VALUES ($1, $2, $3)", [salaId, user.id, joinedAt]);
}

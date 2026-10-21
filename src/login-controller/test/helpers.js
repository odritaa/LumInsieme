import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "../src/database.js";

export const SECRET = process.env.JWT_SECRET;

export async function createUser(overrides = {}) {
  const id = crypto.randomUUID();
  const { rows } = await query(
    `INSERT INTO users (id, google_sub, email, name) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, overrides.googleSub ?? `google-${id}`, overrides.email ?? `${id}@luminsieme.test`, overrides.name ?? "Usuario Test"]
  );
  return rows[0];
}

export function sessionFor(user, { secret = SECRET, ...options } = {}) {
  return jwt.sign({ email: user.email, name: user.name }, secret, {
    subject: user.id,
    issuer: "luminsieme-login-controller",
    audience: "luminsieme",
    expiresIn: "1h",
    algorithm: "HS256",
    ...options,
  });
}

export const cookie = (token) => `lum_session=${token}`;

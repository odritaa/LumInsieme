import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import pool, { query } from "../src/database.js";
import { cookie, createUser, sessionFor } from "./helpers.js";

afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

function idToken(claims) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.firma`;
}

function setCookies(res) {
  return [res.headers["set-cookie"] ?? []].flat();
}

describe("CU-01 Autenticacion — sesion JWT", () => {
  it("PT-CU01-01 GET /auth/me sin cookie → 401 unauthenticated", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthenticated" });
  });

  it("PT-CU01-02 GET /auth/me con JWT válido en cookie → 200 con el perfil (sin googleSub)", async () => {
    const user = await createUser({ name: "Ana" });
    const res = await request(app).get("/auth/me").set("Cookie", cookie(sessionFor(user)));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, name: "Ana", email: user.email, genres: [], favoriteMovies: [] });
    expect(res.body.user).not.toHaveProperty("googleSub");
  });

  it("PT-CU01-03 GET /auth/me con JWT válido por Authorization: Bearer → 200", async () => {
    const user = await createUser();
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${sessionFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("PT-CU01-04 GET /auth/me con JWT vencido → 401 invalid_token", async () => {
    const user = await createUser();
    const expired = sessionFor(user, { expiresIn: -10 });
    const res = await request(app).get("/auth/me").set("Cookie", cookie(expired));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_token");
  });

  it("PT-CU01-05 GET /auth/me con JWT firmado con otro secreto → 401 invalid_token", async () => {
    const user = await createUser();
    const forged = sessionFor(user, { secret: "otro-secreto-de-al-menos-32-caracteres!!" });
    const res = await request(app).get("/auth/me").set("Cookie", cookie(forged));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_token");
  });

  it("PT-CU01-06 GET /auth/me con JWT alg=none (sin firma) → 401", async () => {
    const user = await createUser();
    const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${part({ alg: "none", typ: "JWT" })}.${part({
      sub: user.id,
      iss: "luminsieme-login-controller",
      aud: "luminsieme",
      iat: now,
      exp: now + 3600,
    })}.`;
    const res = await request(app).get("/auth/me").set("Cookie", cookie(unsigned));
    expect(res.status).toBe(401);
  });

  it("PT-CU01-07 GET /auth/me con JWT alg=HS512 (mismo secreto) → 401", async () => {
    const user = await createUser();
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", cookie(sessionFor(user, { algorithm: "HS512" })));
    expect(res.status).toBe(401);
  });

  it("PT-CU01-08 Ticket de chat (otro iss/aud) usado como sesión → 401", async () => {
    const user = await createUser();
    const ticket = jwt.sign({ name: user.name, sala: "x" }, process.env.JWT_SECRET, {
      subject: user.id,
      issuer: "luminsieme-reunion-controller",
      audience: "luminsieme-chat",
      expiresIn: "5m",
    });
    const res = await request(app).get("/auth/me").set("Cookie", cookie(ticket));
    expect(res.status).toBe(401);
  });

  it("PT-CU01-09 JWT válido de un usuario borrado → 401 y cookie expirada", async () => {
    const user = await createUser();
    await query("DELETE FROM users WHERE id = $1", [user.id]);
    const res = await request(app).get("/auth/me").set("Cookie", cookie(sessionFor(user)));
    expect(res.status).toBe(401);
    expect(setCookies(res).join()).toMatch(/lum_session=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe("CU-01 Autenticacion — flujo OAuth con Google", () => {
  it("PT-CU01-10 GET /auth/google → 302 a Google con state y cookie de state HttpOnly en /auth", async () => {
    const res = await request(app).get("/auth/google");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin).toBe("https://accounts.google.com");
    const state = location.searchParams.get("state");
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    const stateCookie = setCookies(res).find((c) => c.startsWith("lum_oauth_state="));
    expect(stateCookie).toContain(`lum_oauth_state=${state}`);
    expect(stateCookie).toMatch(/HttpOnly/);
    expect(stateCookie).toMatch(/Path=\/auth/);
  });

  it("PT-CU01-11 Callback con state distinto al de la cookie → redirect /?error=invalid_state sin sesión", async () => {
    const res = await request(app)
      .get("/auth/google/callback?code=abc&state=manipulado")
      .set("Cookie", "lum_oauth_state=original");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/?error=invalid_state");
    expect(setCookies(res).some((c) => c.startsWith("lum_session="))).toBe(false);
  });

  it("PT-CU01-12 Callback sin cookie de state → redirect /?error=invalid_state", async () => {
    const res = await request(app).get("/auth/google/callback?code=abc&state=cualquiera");
    expect(res.headers.location).toBe("http://localhost:5173/?error=invalid_state");
  });

  it("PT-CU01-13 Callback con error de Google (usuario cancela) → redirect /?error=access_denied", async () => {
    const res = await request(app).get("/auth/google/callback?error=access_denied");
    expect(res.headers.location).toBe("http://localhost:5173/?error=access_denied");
  });

  it("PT-CU01-14 Callback válido (token endpoint simulado) → usuario creado, cookie de sesión y redirect /feed", async () => {
    const sub = `google-${Date.now()}`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id_token: idToken({
            iss: "https://accounts.google.com",
            aud: process.env.GOOGLE_CLIENT_ID,
            exp: Math.floor(Date.now() / 1000) + 600,
            sub,
            email: `${sub}@gmail.com`,
            email_verified: true,
            name: "Nuevo Usuario",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const res = await request(app)
      .get("/auth/google/callback?code=codigo&state=s1")
      .set("Cookie", "lum_oauth_state=s1");

    expect(res.headers.location).toBe("http://localhost:5173/feed");
    const session = setCookies(res).find((c) => c.startsWith("lum_session="));
    expect(session).toMatch(/HttpOnly/);
    const { rows } = await query("SELECT name FROM users WHERE google_sub = $1", [sub]);
    expect(rows[0].name).toBe("Nuevo Usuario");
  });

  it("PT-CU01-15 Callback con fallo del token endpoint → redirect /?error=oauth_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid_grant", { status: 400 }));
    const res = await request(app)
      .get("/auth/google/callback?code=codigo&state=s2")
      .set("Cookie", "lum_oauth_state=s2");
    expect(res.headers.location).toBe("http://localhost:5173/?error=oauth_failed");
  });
});

describe("CU-01 Autenticacion — PATCH /auth/me", () => {
  const patch = async (body) => {
    const user = await createUser();
    return request(app).patch("/auth/me").set("Cookie", cookie(sessionFor(user))).send(body);
  };

  it.each([
    ["PT-CU01-16", "edad menor a 13", { age: 12 }],
    ["PT-CU01-17", "edad mayor a 120", { age: 121 }],
    ["PT-CU01-18", "edad como texto", { age: "30" }],
  ])("%s PATCH /auth/me con %s → 400 invalid_profile", async (_id, _desc, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_profile");
  });

  it("PT-CU01-19 PATCH /auth/me con géneros fuera de la lista blanca → 400 invalid_profile", async () => {
    const res = await patch({ genres: ["Drama", "Telenovela"] });
    expect(res.status).toBe(400);
    expect(res.body.details.join()).toMatch(/Telenovela/);
  });

  it("PT-CU01-20 PATCH /auth/me con 6 películas favoritas → 400 invalid_profile", async () => {
    const movies = Array.from({ length: 6 }, (_, i) => ({ title: `Pelicula ${i}` }));
    const res = await patch({ favoriteMovies: movies });
    expect(res.status).toBe(400);
  });

  it("PT-CU01-21 PATCH /auth/me sin campos editables → 400", async () => {
    const res = await patch({ email: "otro@mail.com" });
    expect(res.status).toBe(400);
  });

  it("PT-CU01-22 PATCH /auth/me válido → 200, perfil persistido y géneros deduplicados", async () => {
    const user = await createUser();
    const res = await request(app)
      .patch("/auth/me")
      .set("Cookie", cookie(sessionFor(user)))
      .send({ age: 30, city: " Rosario ", genres: ["Drama", "Drama", "Terror"], favoriteMovies: [{ title: "Nueve Reinas" }] });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ age: 30, city: "Rosario", genres: ["Drama", "Terror"] });
    const again = await request(app).get("/auth/me").set("Cookie", cookie(sessionFor(user)));
    expect(again.body.user.favoriteMovies).toEqual([{ initials: "", title: "Nueve Reinas" }]);
  });

  it("PT-CU01-23 PATCH /auth/me sin sesión → 401", async () => {
    const res = await request(app).patch("/auth/me").send({ age: 30 });
    expect(res.status).toBe(401);
  });
});

describe("CU-01 Autenticacion — cierre de sesion y baja", () => {
  it("PT-CU01-24 POST /auth/logout → 204 y cookie lum_session expirada", async () => {
    const res = await request(app).post("/auth/logout").set("Cookie", "lum_session=algo");
    expect(res.status).toBe(204);
    const session = setCookies(res).find((c) => c.startsWith("lum_session="));
    expect(session).toMatch(/^lum_session=;/);
    expect(session).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("PT-CU01-25 DELETE /auth/me → 204 y usuario eliminado", async () => {
    const user = await createUser();
    const res = await request(app).delete("/auth/me").set("Cookie", cookie(sessionFor(user)));
    expect(res.status).toBe(204);
    const { rowCount } = await query("SELECT 1 FROM users WHERE id = $1", [user.id]);
    expect(rowCount).toBe(0);
  });

  it("PT-CU01-26 GET /health con la base disponible → 200 {status: ok, db: ok}", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });
});

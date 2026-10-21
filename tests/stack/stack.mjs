// Orquesta el stack de pruebas: node tests/stack/stack.mjs <up|seed|down|env> [servicios...]
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE_FILE = path.join(DIR, "docker-compose.test.yml");
const ENV_FILE = path.join(DIR, "test.env");
const FIXTURES_FILE = path.join(DIR, "fixtures.local.json");
const TIMEZONE = "America/Argentina/Buenos_Aires";

export function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
  );
}

function ensureEnv() {
  if (existsSync(ENV_FILE)) return readEnv();
  const env = {
    POSTGRES_PASSWORD: crypto.randomBytes(16).toString("hex"),
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
  };
  writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  return env;
}

function compose(args, options = {}) {
  return execFileSync("docker", ["compose", "--env-file", ENV_FILE, "-f", COMPOSE_FILE, ...args], {
    stdio: options.input ? ["pipe", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    ...options,
  });
}

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signJwt(claims, secret, ttlSeconds = 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ iat: now, exp: now + ttlSeconds, ...claims });
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function sessionToken(user, secret) {
  return signJwt(
    { email: user.email, name: user.name, sub: user.id, iss: "luminsieme-login-controller", aud: "luminsieme" },
    secret
  );
}

function isoDate(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

// Formato actual del scrapper: claves "AAAA-M-D" sin ceros a la izquierda.
const scraperKey = (iso) => iso.split("-").map(Number).join("-");

function cartelera() {
  const movie = (title, date, screenings) => ({
    title,
    date,
    duration: "1 hora",
    theater: "Multiplex Belgrano",
    screenings,
  });
  const today = isoDate(0);
  const tomorrow = isoDate(1);
  const after = isoDate(2);
  return [
    {
      [scraperKey(today)]: [
        movie("Funcion Temprana E2E", today, [{ type: "2D Español", hours: ["00:01"] }]),
        movie("Funcion Nocturna E2E", today, [{ type: "2D Subtitulada", hours: ["23:59"] }]),
      ],
      [scraperKey(tomorrow)]: [
        movie("Dune: Parte Tres", tomorrow, [
          { type: "2D Subtitulada", hours: ["18:30", "21:00"] },
          { type: "3D Español", hours: ["16:00"] },
        ]),
        movie("El Secreto de sus Ojos", tomorrow, [{ type: "2D Español", hours: ["20:15"] }]),
      ],
      [scraperKey(after)]: [movie("Relatos Salvajes", after, [{ type: "2D Español", hours: ["19:00"] }])],
    },
  ];
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function seed() {
  const { JWT_SECRET } = readEnv();
  if (!JWT_SECRET) throw new Error("falta test.env: correr primero 'up'");

  const user = (name, i) => ({
    id: crypto.randomUUID(),
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@luminsieme.test`,
  });
  const e2e = [user("Ana E2E", 1), user("Bruno E2E", 2)];
  const load = Array.from({ length: 60 }, (_, i) => user(`Carga ${i + 1}`, i + 100));

  // 12 salas de 5 miembros para el chat bajo carga y 20 salas extra para el feed.
  const salas = [];
  for (let s = 0; s < 32; s++) {
    const members = s < 12 ? load.slice(s * 5, s * 5 + 5) : [load[s % load.length]];
    salas.push({ id: crypto.randomUUID(), host: members[0], members, movie: `Sala de carga ${s + 1}` });
  }

  const sql = [
    "BEGIN;",
    "TRUNCATE sala_miembros, salas, users CASCADE;",
    ...[...e2e, ...load].map(
      (u) =>
        `INSERT INTO users (id, google_sub, email, name, genres) VALUES (${sqlString(u.id)}, ${sqlString(
          `google-${u.id}`
        )}, ${sqlString(u.email)}, ${sqlString(u.name)}, ARRAY['Drama','Comedia']);`
    ),
    ...salas.flatMap((s, i) => [
      `INSERT INTO salas (id, host_id, movie, place, date, time, capacity, note, created_at) VALUES (${sqlString(
        s.id
      )}, ${sqlString(s.host.id)}, ${sqlString(s.movie)}, 'Multiplex Belgrano', ${sqlString(
        isoDate(1 + (i % 3))
      )}, '20:00', 6, 'Sembrada por stack.mjs', now() - interval '${i} minutes');`,
      ...s.members.map(
        (m, j) =>
          `INSERT INTO sala_miembros (sala_id, user_id, joined_at) VALUES (${sqlString(s.id)}, ${sqlString(
            m.id
          )}, now() - interval '${60 - j} seconds');`
      ),
    ]),
    "COMMIT;",
  ].join("\n");

  compose(["exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", "luminsieme", "-d", "luminsieme"], {
    input: sql,
  });
  compose(["exec", "-T", "redis", "redis-cli", "-x", "SET", "scraped_data"], {
    input: JSON.stringify(cartelera()),
  });

  const withToken = (u) => ({ ...u, token: sessionToken(u, JWT_SECRET) });
  const fixtures = {
    baseUrl: "https://localhost:8443",
    timezone: TIMEZONE,
    users: e2e.map(withToken),
    load: {
      users: load.map(withToken),
      chatSalas: salas.slice(0, 12).map((s) => ({ id: s.id, members: s.members.map((m) => m.id) })),
    },
  };
  writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2));
  console.log(`[stack] ${e2e.length + load.length} usuarios, ${salas.length} salas y cartelera sembrados`);
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const [command, ...services] = process.argv.slice(2);
  switch (command) {
    case "up":
      ensureEnv();
      compose(["up", "-d", "--build", "--wait", ...services]);
      break;
    case "seed":
      seed();
      break;
    case "down":
      compose(["down", "-v", "--remove-orphans"]);
      break;
    case "env":
      ensureEnv();
      break;
    default:
      console.error("uso: node tests/stack/stack.mjs <up|seed|down|env> [servicios...]");
      process.exit(1);
  }
}

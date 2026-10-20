import "dotenv/config";

const REQUIRED = ["DATABASE_URL", "FRONTEND_URL", "JWT_SECRET"];

const problems = [];

for (const key of REQUIRED) {
  if (!process.env[key]?.trim()) problems.push(`${key} es obligatoria y esta vacia`);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  problems.push("JWT_SECRET debe tener al menos 32 caracteres");
}

function integer(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    problems.push(`${key} debe ser un entero, se recibio "${raw}"`);
    return fallback;
  }
  return parsed;
}

function text(key, fallback) {
  const raw = process.env[key];
  return raw?.trim() ? raw.trim() : fallback;
}

const nodeEnv = text("NODE_ENV", "development");

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: integer("PORT", 4100),
  databaseUrl: process.env.DATABASE_URL,
  cacheGrpcAddr: text("CACHE_GRPC_ADDR", "localhost:50051"),
  frontendUrl: text("FRONTEND_URL", "")?.replace(/\/+$/, ""),
  timezone: text("TIMEZONE", "America/Argentina/Buenos_Aires"),
  jwt: {
    secret: process.env.JWT_SECRET,
    chatTicketExpiresIn: "5m",
  },
  cookieName: text("COOKIE_NAME", "lum_session"),
};

if (problems.length > 0) {
  console.error("[config] no se puede iniciar el reunion-controller:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("[config] copia .env.example a .env y completa los valores faltantes");
  process.exit(1);
}

export default Object.freeze(config);

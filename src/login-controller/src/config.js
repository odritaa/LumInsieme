import "dotenv/config";

const REQUIRED = [
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "FRONTEND_URL",
  "JWT_SECRET",
];

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

function boolean(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "false") return normalized === "true";
  problems.push(`${key} debe ser "true" o "false", se recibio "${raw}"`);
  return fallback;
}

function text(key, fallback) {
  const raw = process.env[key];
  return raw?.trim() ? raw.trim() : fallback;
}

const nodeEnv = text("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const config = {
  nodeEnv,
  isProduction,
  port: integer("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: text("FRONTEND_URL", "")?.replace(/\/+$/, ""),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: text("JWT_EXPIRES_IN", "24h"),
  },
  cookie: {
    name: text("COOKIE_NAME", "lum_session"),
    stateName: "lum_oauth_state",
    secure: boolean("COOKIE_SECURE", isProduction),
    sameSite: text("COOKIE_SAMESITE", "lax"),
    maxAge: 24 * 60 * 60 * 1000,
    stateMaxAge: 10 * 60 * 1000,
  },
};

if (problems.length > 0) {
  console.error("[config] no se puede iniciar el login-controller:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("[config] copia .env.example a .env y completa los valores faltantes");
  process.exit(1);
}

export default Object.freeze(config);

import { existsSync, readFileSync } from "node:fs";

const STACK_ENV = new URL("../../../tests/stack/test.env", import.meta.url);

function stackPassword() {
  if (!existsSync(STACK_ENV)) return "";
  const line = readFileSync(STACK_ENV, "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="));
  return line?.slice("POSTGRES_PASSWORD=".length) ?? "";
}

// Postgres del stack de pruebas (tests/stack); TEST_DATABASE_ADMIN_URL lo reemplaza en CI.
export const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ?? `postgres://luminsieme:${stackPassword()}@localhost:55432/luminsieme`;

export const databaseUrl = (name) => adminUrl.replace(/\/[^/]+$/, `/${name}`);

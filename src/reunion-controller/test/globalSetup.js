import { readFile } from "node:fs/promises";
import pg from "pg";
import { adminUrl, databaseUrl } from "./dbUrl.js";

const DATABASE = "luminsieme_test_reunion";
const SCHEMAS = [
  "../../login-controller/db/init/001_init.sql",
  "../db/init/001_salas.sql",
];

// Base propia y descartable: las salas referencian users, que crea el esquema de login-controller.
export default async function setup() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();

  const db = new pg.Client({ connectionString: databaseUrl(DATABASE) });
  await db.connect();
  for (const file of SCHEMAS) await db.query(await readFile(new URL(file, import.meta.url), "utf8"));
  await db.end();
}

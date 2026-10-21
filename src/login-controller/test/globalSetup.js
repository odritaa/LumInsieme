import { readFile } from "node:fs/promises";
import pg from "pg";
import { adminUrl, databaseUrl } from "./dbUrl.js";

const DATABASE = "luminsieme_test_login";

// Base propia y descartable: las pruebas nunca tocan la base de desarrollo.
export default async function setup() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();

  const db = new pg.Client({ connectionString: databaseUrl(DATABASE) });
  await db.connect();
  await db.query(await readFile(new URL("../db/init/001_init.sql", import.meta.url), "utf8"));
  await db.end();
}

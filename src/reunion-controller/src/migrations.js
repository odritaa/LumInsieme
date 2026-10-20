import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./database.js";

const INIT_DIR = path.resolve(fileURLToPath(new URL("../db/init", import.meta.url)));
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2000;

// Tabla propia: los nombres de archivo chocarian con los de login-controller en schema_migrations.
async function applyPending() {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS reunion_migrations (
         filename   TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );

    const files = (await readdir(INIT_DIR)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM reunion_migrations WHERE filename = $1",
        [file]
      );
      if (rowCount > 0) continue;

      const sql = await readFile(path.join(INIT_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO reunion_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] ${file} aplicada`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

// Las salas referencian users, que crea login-controller: si todavia no existe, se reintenta.
export async function migrate() {
  for (let attempt = 1; ; attempt++) {
    try {
      await applyPending();
      return;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`[migrate] intento ${attempt} fallido (${error.message}), reintentando`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

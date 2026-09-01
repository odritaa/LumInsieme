import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../database.js";

const INIT_DIR = path.resolve(fileURLToPath(new URL("../../db/init", import.meta.url)));

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );

    const files = (await readdir(INIT_DIR)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file]
      );
      if (rowCount > 0) {
        console.log(`[migrate] ${file} ya aplicada`);
        continue;
      }

      const sql = await readFile(path.join(INIT_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] ${file} aplicada`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("[migrate] fallo:", error.message);
  process.exit(1);
});

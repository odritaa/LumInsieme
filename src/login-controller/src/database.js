import pg from "pg";
import config from "./config.js";

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (error) => {
  console.error("[db] error en el pool:", error.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function ping() {
  await pool.query("SELECT 1");
  return true;
}

export default pool;

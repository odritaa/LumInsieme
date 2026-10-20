import pg from "pg";
import config from "./config.js";

// DATE y TIME se devuelven como texto: convertirlos a Date los corre de dia segun la zona del proceso.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIME, (value) => value);

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

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function ping() {
  await pool.query("SELECT 1");
  return true;
}

export default pool;

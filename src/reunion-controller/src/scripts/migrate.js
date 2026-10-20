import pool from "../database.js";
import { migrate } from "../migrations.js";

migrate()
  .then(() => console.log("[migrate] esquema al dia"))
  .catch((error) => {
    console.error("[migrate] fallo:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

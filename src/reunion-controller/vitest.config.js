import { defineConfig } from "vitest/config";
import { databaseUrl } from "./test/dbUrl.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/globalSetup.js"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl("luminsieme_test_reunion"),
      CACHE_GRPC_ADDR: "localhost:1",
      FRONTEND_URL: "http://localhost:5173",
      JWT_SECRET: "test-secret-de-prueba-con-mas-de-32-caracteres",
      COOKIE_NAME: "lum_session",
      TIMEZONE: "America/Argentina/Buenos_Aires",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/server.js", "src/scripts/**"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});

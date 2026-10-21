import { defineConfig } from "vitest/config";
import { databaseUrl } from "./test/dbUrl.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/globalSetup.js"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl("luminsieme_test_login"),
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:4000/auth/google/callback",
      FRONTEND_URL: "http://localhost:5173",
      JWT_SECRET: "test-secret-de-prueba-con-mas-de-32-caracteres",
      JWT_EXPIRES_IN: "24h",
      COOKIE_NAME: "lum_session",
      COOKIE_SECURE: "false",
      COOKIE_SAMESITE: "lax",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/server.js", "src/scripts/**"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      PORT: "0",
      CACHE_GRPC_ADDR: "127.0.0.1:50999",
      JWT_SECRET: "test-secret-de-prueba-con-mas-de-32-caracteres",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});

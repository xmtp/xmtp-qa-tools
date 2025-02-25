import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/__vitest__/#/",
  test: {
    globals: true,
    reporters: ["default"],
    environment: "node",
    watch: false,
    testTimeout: 100000,
    hookTimeout: 100000,
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
  },
});

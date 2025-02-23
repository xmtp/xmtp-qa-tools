import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    reporters: ["html", "default"],
    environment: "node",
    watch: false,
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
  },
});

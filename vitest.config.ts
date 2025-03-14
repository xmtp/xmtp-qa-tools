import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/__vitest__/#/",
  resolve: {
    alias: {
      "@helpers": resolve(__dirname, "./helpers"),
      "@scripts": resolve(__dirname, "./scripts"),
      "@agents": resolve(__dirname, "./agents"),
    },
  },
  test: {
    globals: true,
    reporters: ["default"],
    environment: "node",
    watch: false,
    testTimeout: 100000,
    hookTimeout: 100000,
    pool: "threads",
    poolOptions: {
      singleThread: true,
    },
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
    // Add this to suppress unhandled errors at the end
    dangerouslyIgnoreUnhandledErrors: true,
  },
});

import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/__vitest__/#/",
  resolve: {
    alias: {
      "@helpers": resolve(__dirname, "./helpers"),
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
    }, // Add these options to better handle cleanup errors
    teardownTimeout: 10000, // Timeout for teardown operations
    onConsoleLog(log) {
      // Optional: customize console log handling
      return log.includes("Ignoring expected HPKE key") ? false : true;
    },
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
  },
});

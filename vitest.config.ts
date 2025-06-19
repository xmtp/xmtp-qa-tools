import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Detect if running in UI mode
const isUIMode = process.argv.includes("--ui");

export default defineConfig({
  base: "/__vitest__/#/",
  resolve: {
    alias: {
      "@helpers": resolve(__dirname, "./helpers"),
      "@workers": resolve(__dirname, "./workers"),
      "@scripts": resolve(__dirname, "./scripts"),
      "@inboxes": resolve(__dirname, "./inboxes"),
      "@bots": resolve(__dirname, "./bots/helpers"),
    },
  },
  test: {
    globals: true,
    reporters: isUIMode ? ["basic"] : ["default"],
    environment: "node",
    watch: false,
    testTimeout: isUIMode ? 300000 : 6000000,
    hookTimeout: isUIMode ? 60000 : 6000000,
    pool: "threads",
    poolOptions: {
      singleThread: true,
      ...(isUIMode && {
        maxThreads: 1,
        minThreads: 1,
      }),
    },
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
    dangerouslyIgnoreUnhandledErrors: true,
    ...(isUIMode && {
      silent: false,
      maxConcurrency: 1,
      isolate: true,
    }),
  },
});

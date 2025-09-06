import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Detect if running in UI mode (vitest --ui launches web-based test dashboard)
const isUIMode = process.argv.includes("--ui");

export default defineConfig({
  // Base URL path for Vitest UI - simpler path for better stability
  base: "/",
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
    reporters: isUIMode ? [["default", { summary: false }]] : ["default"],
    environment: "node",
    watch: false,
    // Optimize test timeouts - reduce from 100 minutes for better feedback
    testTimeout: isUIMode ? 300000 : 3600000, // 5min vs 60min (was 100min)
    hookTimeout: isUIMode ? 60000 : 3600000, // 1min vs 60min (was 100min)
    pool: "threads",
    poolOptions: {
      singleThread: true,
      // Limit memory usage in UI mode
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
    // UI-specific optimizations
    ...(isUIMode && {
      // Skip console logs entirely in UI mode to reduce noise
      onConsoleLog: () => false,
      // Limit concurrent tests
      maxConcurrency: 1,
      // Enable test isolation
      isolate: true,
    }),
  },
});

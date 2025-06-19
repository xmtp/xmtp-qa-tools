import { resolve } from "path";
import { defineConfig } from "vitest/config";

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
    reporters: ["default"],
    environment: "node",
    watch: false,
    testTimeout: 6000000,
    hookTimeout: 6000000,
    pool: "threads",
    poolOptions: {
      singleThread: true,
    },
    api: {
      host: "0.0.0.0",
      port: 51204,
    },
    dangerouslyIgnoreUnhandledErrors: true,
  },
});

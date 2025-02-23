import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // Use a more verbose reporter to log detailed output
    reporters: "verbose",
    watch: false, // Disable automatic test runs on file changes
    // Add server configuration
    api: {
      host: "0.0.0.0", // Bind to all interfaces
      port: 51204, // Use Railway's assigned port or default
      allowedHosts: ["qa-testing-production.up.railway.app"],
    },
  },
});

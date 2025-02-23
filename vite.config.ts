import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0", // Bind to all interfaces
    port: 51204, // Use Railway's assigned port or default
    allowedHosts: ["qa-testing-production.up.railway.app"], // Allow the specific host
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  base: "/__vitest__/#/",
  server: {
    host: true,
    port: 51204, // Use Railway's assigned port or default
    allowedHosts: true,
  },
});

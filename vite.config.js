import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 51204, // Use Railway's assigned port or default
    allowedHosts: true,
  },
});

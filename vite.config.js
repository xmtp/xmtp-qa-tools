import { defineConfig } from "vite";

export default defineConfig({
  title: "QA Testing",
  icon: "./public/favicon.ico",
  server: {
    host: true,
    port: 51204, // Use Railway's assigned port or default
    allowedHosts: true,
  },
  api: {
    host: true,
    port: 51204, // Use Railway's assigned port or default
    allowedHosts: true,
  },
});

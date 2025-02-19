import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // Use a more verbose reporter to log detailed output
    reporters: "verbose",
  },
});

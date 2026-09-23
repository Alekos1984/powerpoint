import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/pages",
  publicDir: false,
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/pages/index.html"),
        wizard: resolve(__dirname, "src/pages/wizard.html"),
        prompts: resolve(__dirname, "src/pages/prompts.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8888",
    },
  },
});

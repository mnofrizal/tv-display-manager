import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': 'https://api.tv-sla.my.id',
      '/socket.io': {
        target: 'https://api.tv-sla.my.id',
        ws: true,
      },
      '/uploads': 'https://api.tv-sla.my.id',
    },
  },
  preview: {
    port: 1286,
  },
  build: {
    outDir: '../dist',
  },
});

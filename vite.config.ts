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
      '/api': 'http://localhost:1286',
      '/socket.io': {
        target: 'http://localhost:1286',
        ws: true,
      },
      '/uploads': 'http://localhost:1286',
    },
  },
  build: {
    outDir: '../dist',
  },
});

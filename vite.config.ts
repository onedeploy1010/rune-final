import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const basePath = process.env.BASE_PATH;
if (!basePath) throw new Error("BASE_PATH environment variable is required.");

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ["defaults", "iOS >= 11", "Android >= 6", "not IE 11"],
      modernPolyfills: true,
      renderLegacyChunks: true,
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@marketing": path.resolve(import.meta.dirname, "src/marketing"),
      "@app": path.resolve(import.meta.dirname, "src/app"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

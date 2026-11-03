import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execFileSync } from "node:child_process";
function sourceRevision() {
  const configured =
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (/^[a-f0-9]{40}$/.test(configured || "")) return configured!;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

const basePath = process.env.VITE_BASE_PATH || "/";

const isolatedProxy =
  process.env.IMSOP_SYSTEM_API === "http://127.0.0.1:18067"
    ? Object.fromEntries(
        ["/api", "/supply-chain", "/health", "/ready", "/version"].map(
          prefix => [
            prefix,
            { target: process.env.IMSOP_SYSTEM_API, changeOrigin: false },
          ]
        )
      )
    : undefined;
export default defineConfig({
  preview: { proxy: isolatedProxy },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "imsop-release-identity",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "release.json",
          source:
            JSON.stringify({
              frontendRevision: sourceRevision(),
              apiContract: 2,
              builtAt: new Date().toISOString(),
            }) + "\n",
        });
      },
    },
  ],
  base: basePath,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
  server: {
    proxy: isolatedProxy,
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

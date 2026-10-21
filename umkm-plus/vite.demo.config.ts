// Build versi demo (semua jalan di browser): npm run build:demo -> dist-demo/
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);

/** Tukar modul khusus server (Node) dengan versi demo yang jalan di browser. */
function demoSwaps(): Plugin {
  const swaps: Record<string, string> = {
    [path.join(here, "server/auth.ts")]: path.join(here, "demo/auth.ts"),
  };
  return {
    name: "demo-swaps",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "@anthropic-ai/sdk") return path.join(here, "demo/anthropic-stub.ts");
      if (source === "postgres") return path.join(here, "demo/empty.ts");
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && swaps[resolved.id] ? swaps[resolved.id] : null;
    },
  };
}

export default defineConfig({
  root: path.join(here, "demo"),
  base: "./",
  publicDir: path.join(here, "public"),
  plugins: [demoSwaps(), react()],
  // Kode server membaca process.env saat berjalan; arahkan ke objek yang diisi demo/main.tsx.
  define: { "process.env": "globalThis.process.env" },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: { outDir: path.join(here, "dist-demo"), emptyOutDir: true, target: "es2022", assetsInlineLimit: 0 },
});

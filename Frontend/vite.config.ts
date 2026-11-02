// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env["VITE_SUPABASE_URL"] || "https://swqebafkntjlgjglylcr.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["VITE_SUPABASE_ANON_KEY"] ||
          "sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_ANON_KEY"] || "sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE",
      ),
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(
        process.env["VITE_GOOGLE_CLIENT_ID"] ||
          "29523482392-lfhea4ot72omctqbcvq4e9qfrbp692ju.apps.googleusercontent.com",
      ),
    },
    build: {
      chunkSizeWarningLimit: 2500,
    },
    resolve: {
      alias: {
        "@/components": path.resolve(__dirname, "./src/frontend/components"),
        "@/context": path.resolve(__dirname, "./src/frontend/context"),
        "@/hooks": path.resolve(__dirname, "./src/frontend/hooks"),
        "@/frontend": path.resolve(__dirname, "./src/frontend"),
      },
    },
  },
});

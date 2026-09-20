import path from "node:path";
import { defineConfig } from "vitest/config";

// The DB-backed guards need real Supabase credentials. Load them from .env
// the same way `npm run dev` does, so `npm test` works with no extra setup.
// In CI these come from the environment instead and the file is absent.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, ".env"));
} catch {
  // no .env -- fall through to whatever the environment already has
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws by design when imported outside a React Server
      // Component. That protection is real in the app build; under vitest it
      // just stops the module loading, so stub it out here.
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/stubs/server-only.ts",
      ),
    },
  },
  test: {
    environment: "node",
    testTimeout: 20_000,
    env: {
      // A fixed key so the unit tests are deterministic and never touch the
      // real one. Not a secret: it protects nothing.
      TASLAAFA_CODE_KEY: "dGFzbGFhZmEtdGVzdC1rZXktbm90LWEtc2VjcmV0ISE=",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      SEED_PASSWORD: process.env.SEED_PASSWORD ?? "",
    },
  },
});

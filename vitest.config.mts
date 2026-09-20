import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws by design when imported outside a React Server
      // Component. That protection is real in the app build; under vitest it
      // just stops the module loading, so stub it out here.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // A fixed key so code tests are deterministic and never touch the real
    // .env. Not a secret: it protects nothing.
    env: {
      TASLAAFA_CODE_KEY: "dGFzbGFhZmEtdGVzdC1rZXktbm90LWEtc2VjcmV0ISE=",
    },
  },
});

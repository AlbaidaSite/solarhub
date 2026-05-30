import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "node:process";

// Carga `.env.test` si existe (sin instalar dotenv: usamos el `--env-file`
// nativo de Node a través del script en package.json). Aquí solo
// declaramos la configuración de vitest específica de E2E.
void loadEnv;

// IMPORTANTE: los tests E2E corren contra una instancia LOCAL de Supabase
// (npx supabase start). Ver tests/e2e/README.md para el setup.
//
// Si las variables de entorno de la instancia local no están definidas,
// los tests se SKIPEAN limpiamente (en lugar de fallar). Eso permite que
// `npm run test:e2e` no rompa la CI cuando no hay BD disponible.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.test.ts"],
    // Los tests E2E manipulan la misma BD; ejecutarlos en serie evita races.
    // En Vitest 4 las opciones de pool son top-level (antes vivían en
    // `poolOptions.forks`).
    fileParallelism: false,
    // Más generoso que los unit tests: cada operación hace red real.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      // Defaults razonables para una instancia local recién creada.
      // Sobrescribir vía .env.test si tu setup difiere.
      SUPABASE_E2E_URL: process.env.SUPABASE_E2E_URL ?? "http://127.0.0.1:54321",
      SUPABASE_E2E_ANON_KEY: process.env.SUPABASE_E2E_ANON_KEY ?? "",
      SUPABASE_E2E_SERVICE_ROLE_KEY:
        process.env.SUPABASE_E2E_SERVICE_ROLE_KEY ?? "",
    },
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuración:
//   - alias @/* → ./src/* (replica el de tsconfig.json para que los tests
//     puedan importar desde rutas absolutas del repo).
//   - include: cubre tests heredados junto al módulo (src/**/__tests__),
//     tests/unit, tests/integration y tests/components (.tsx).
//   - environment "node" por defecto. Los tests de componentes opt-in a
//     jsdom con el docblock `// @vitest-environment jsdom` (más explícito y
//     más rápido que aplicarlo globalmente).
//   - JSX se transforma vía oxc-transform (built-in de Vitest 4), no se
//     necesita configurar esbuild ni importar React en cada .test.tsx.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` es un marcador en producción (impide que el módulo se
      // incluya en el bundle cliente). En tests es irrelevante; lo aliasamos
      // a un stub vacío para evitar fallos de resolución de módulo.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    // Los tests E2E viven en tests/e2e/*.e2e.test.ts y requieren un
    // Supabase local. Los excluimos de la suite normal para que `npm test`
    // ejecute solo unit + integration + componentes. Para E2E: `npm run test:e2e`.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    // Variables de entorno mínimas para que `src/lib/supabase/server.ts` no
    // lance al ser importado por las actions bajo test. Los tests mockean
    // tanto el cliente como las RPCs; estos valores no se usan en red real.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});

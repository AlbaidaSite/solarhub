// Contexto común de los scripts de Bunny. Se ejecutan en local con tsx
// (pnpm bunny:migrate / pnpm bunny:cleanup) leyendo .env.local; nunca en
// build. No pueden importar nada que importe server-only o next/*, así que
// usan api.ts y el cliente de supabase-js directamente, no config.ts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BunnyApiConfig } from "@/lib/bunny/api";
import { BunnyConfigError, parseBunnyEnv } from "@/lib/bunny/env";

/** Sin --apply los scripts solo cuentan lo que harían. */
export const APPLY = process.argv.includes("--apply");

export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

export interface ScriptContext {
  admin: SupabaseClient;
  bunny: BunnyApiConfig;
}

export function loadScriptContext(scriptName: string): ScriptContext {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  let bunny: BunnyApiConfig;
  try {
    bunny = parseBunnyEnv(process.env, ["libraryId", "apiKey"]);
  } catch (err) {
    console.error(err instanceof BunnyConfigError ? err.message : err);
    process.exit(1);
  }

  // Que se vea contra qué se trabaja antes de tocar nada: Supabase y la
  // library de Bunny tienen que ser del mismo entorno.
  console.log(
    `${scriptName} · ${APPLY ? "APPLY" : "DRY-RUN (añade --apply para ejecutar)"}\n` +
      `  Supabase: ${new URL(url).host}\n` +
      `  Bunny library: ${bunny.libraryId}\n`,
  );

  return {
    admin: createClient(url, serviceKey, { auth: { persistSession: false } }),
    bunny,
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Lectura y validación de las variables de Bunny. Puro (recibe el objeto
// env): lo usan config.ts (servidor, con server-only) y los scripts de
// scripts/bunny/, que no pueden importar server-only.

export const BUNNY_ENV = {
  libraryId: "BUNNY_STREAM_LIBRARY_ID",
  apiKey: "BUNNY_STREAM_API_KEY",
  readonlyApiKey: "BUNNY_STREAM_READONLY_API_KEY",
  tokenKey: "BUNNY_STREAM_TOKEN_KEY",
  cdnHostname: "NEXT_PUBLIC_BUNNY_CDN_HOSTNAME",
} as const;

export type BunnyEnvKey = keyof typeof BUNNY_ENV;

export class BunnyConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Faltan variables de entorno de Bunny: ${missing.join(", ")}`);
    this.name = "BunnyConfigError";
    this.missing = missing;
  }
}

/** Devuelve las claves pedidas; lanza BunnyConfigError con todas las que falten. */
export function parseBunnyEnv<K extends BunnyEnvKey>(
  env: Record<string, string | undefined>,
  keys: readonly K[],
): Record<K, string> {
  const missing: string[] = [];
  const result = {} as Record<K, string>;
  for (const key of keys) {
    const value = env[BUNNY_ENV[key]]?.trim();
    if (!value) missing.push(BUNNY_ENV[key]);
    else result[key] = value;
  }
  if (missing.length > 0) throw new BunnyConfigError(missing);
  return result;
}

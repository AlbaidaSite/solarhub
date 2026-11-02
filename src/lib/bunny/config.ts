import "server-only";
import { BUNNY_ENV, BunnyConfigError, parseBunnyEnv } from "./env";

export { BunnyConfigError };

export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  readonlyApiKey: string;
  tokenKey: string;
  cdnHostname: string;
}

const ALL_KEYS = Object.keys(BUNNY_ENV) as Array<keyof typeof BUNNY_ENV>;

// Se lee en cada petición, nunca al importar: `pnpm build` y los tests
// tienen que pasar sin las variables de Bunny definidas.
export function getBunnyConfig(): BunnyConfig {
  return parseBunnyEnv(process.env, ALL_KEYS);
}

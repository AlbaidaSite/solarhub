import {
  getBool,
  getInt,
  getJsonIntArray,
  getOptionalString,
  getString,
} from "./formData";

export const CROMO_SMALLINT_MIN = -32768;
export const CROMO_SMALLINT_MAX = 32767;
export const CROMO_SMALLINT_RANGE =
  CROMO_SMALLINT_MAX - CROMO_SMALLINT_MIN + 1;

export interface CromoFields {
  name: string;
  description: string | null;
  number: number;
  variant: number;
  categoryId: number;
  rarityId: number;
  howTo: string | null;
  howToExtended: string | null;
  copies: number;
  allowMultiple: boolean;
  forLoukou: boolean;
  artistIds: number[];
  codes: number[];
}

// `errors` es la lista completa de problemas detectados; `error` es la misma
// lista unida con saltos de línea, pensada para mostrarse directamente en un
// <p className="whitespace-pre-line">.
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[]; error: string };

// Parsea y valida los campos comunes de cromo (create + update). A diferencia
// de la versión anterior, acumula TODOS los errores y los devuelve juntos
// para que el usuario los pueda corregir de una sola pasada en vez de uno a
// uno tras cada submit.
export function parseCromoFields(formData: FormData): ParseResult<CromoFields> {
  const errors: string[] = [];

  const name = getString(formData, "name");
  const description = getOptionalString(formData, "description");
  const number = getInt(formData, "number");
  const variant = getInt(formData, "variant");
  const categoryId = getInt(formData, "categoryId");
  const rarityId = getInt(formData, "rarityId");
  const howTo = getOptionalString(formData, "howTo");
  const howToExtended = getOptionalString(formData, "howToExtended");
  const copies = getInt(formData, "copies");
  const allowMultiple = getBool(formData, "allowMultiple");
  const forLoukou = getBool(formData, "forLoukou");

  if (!name) errors.push("El nombre es obligatorio.");
  if (!Number.isInteger(number) || number <= 0) errors.push("Número inválido.");
  if (!Number.isInteger(variant) || variant < 0)
    errors.push("Variante inválida.");
  if (!Number.isInteger(categoryId) || categoryId <= 0)
    errors.push("Categoría inválida.");
  if (!Number.isInteger(rarityId) || rarityId <= 0)
    errors.push("Rareza inválida.");
  if (!Number.isInteger(copies) || copies <= 0)
    errors.push("Copias inválido.");

  const codes = getJsonIntArray(formData, "codes");
  if (!codes) {
    errors.push("Codes inválidos (formato no reconocido).");
  } else {
    if (Number.isInteger(copies) && copies > 0 && codes.length !== copies)
      errors.push("Codes desincronizados con copias.");
    if (codes.some((c) => c < CROMO_SMALLINT_MIN || c > CROMO_SMALLINT_MAX))
      errors.push("Algún code está fuera de rango smallint.");
  }

  const artistIds = getJsonIntArray(formData, "artistIds") ?? [];

  if (errors.length > 0) {
    return { ok: false, errors, error: errors.join("\n") };
  }

  return {
    ok: true,
    data: {
      name,
      description,
      number,
      variant,
      categoryId,
      rarityId,
      howTo,
      howToExtended,
      copies,
      allowMultiple,
      forLoukou,
      artistIds: artistIds!,
      codes: codes!,
    },
  };
}

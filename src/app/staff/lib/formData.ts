// Helpers tipados para extraer campos de un FormData. Reemplazan el patrón
// repetido `String(fd.get("x") ?? "").trim()` y `Number(fd.get("y"))` que
// aparecía en cada server action.

export function getString(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function getOptionalString(fd: FormData, key: string): string | null {
  const s = getString(fd, key);
  return s === "" ? null : s;
}

export function getInt(fd: FormData, key: string): number {
  return Number(fd.get(key));
}

export function getBool(fd: FormData, key: string): boolean {
  return fd.get(key) === "true";
}

// Devuelve el File solo si existe y tiene contenido; null en cualquier otro caso.
export function getFile(fd: FormData, key: string): File | null {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

// Parsea un campo JSON con un array de enteros. Devuelve null si no es un
// array de enteros válido o si el JSON es inválido.
export function getJsonIntArray(fd: FormData, key: string): number[] | null {
  try {
    const parsed = JSON.parse(String(fd.get(key) ?? ""));
    return Array.isArray(parsed) && parsed.every(Number.isInteger)
      ? (parsed as number[])
      : null;
  } catch {
    return null;
  }
}

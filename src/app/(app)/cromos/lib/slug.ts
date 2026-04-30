// Slugs canónicos a partir del nombre del cromo. Sin tildes, lowercase,
// caracteres no alfanuméricos colapsan a guiones, sin guiones al borde.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Construye `<id>-<slug>` para usar en `/cromos/c/<id>-<slug>`. Si el
// nombre no produce slug (vacío o sólo caracteres especiales), cae a `<id>`.
export function buildIdSlug(id: number, name: string): string {
  const slug = slugify(name);
  return slug ? `${id}-${slug}` : String(id);
}

// Prefijo bajo el que viven los segmentos dinámicos de cromo. Está
// aislado de hermanos como `/cromos/registrar` para que la intercepting
// route `@modal/(.)c/[idSlug]` no capture rutas estáticas.
export const CROMO_PATH_PREFIX = "/cromos/c";

// Regex para detectar URLs de detalle de cromo (modal o full page).
export const CROMO_DETAIL_PATH_RE = /^\/cromos\/c\/\d/;

export function cromoPath(idSlug: string): string {
  return `${CROMO_PATH_PREFIX}/${idSlug}`;
}

export function buildCromoPath(id: number, name: string): string {
  return cromoPath(buildIdSlug(id, name));
}

// Parser estricto: el segmento debe empezar por dígitos. Devuelve null
// si no encaja para que la ruta pueda 404 sin tocar la DB.
export function parseIdSlug(
  idSlug: string,
): { id: number; slug: string } | null {
  const match = idSlug.match(/^(\d+)(?:-(.*))?$/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  if (!Number.isFinite(id)) return null;
  return { id, slug: match[2] ?? "" };
}

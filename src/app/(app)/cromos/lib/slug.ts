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

// Construye `<id>-<slug>` para usar en `/cromos/<id>-<slug>`. Si el
// nombre no produce slug (vacío o sólo caracteres especiales), cae a `<id>`.
export function buildIdSlug(id: number, name: string): string {
  const slug = slugify(name);
  return slug ? `${id}-${slug}` : String(id);
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

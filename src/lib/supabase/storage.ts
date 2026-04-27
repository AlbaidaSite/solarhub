const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'solarhub-assets';

// Construye la URL pública sin instanciar un cliente de Supabase, así
// se puede llamar tanto desde server como desde client components.
export function getStorageUrl(path: string, bucket: string = DEFAULT_BUCKET): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// Devuelve la URL del thumbnail siguiendo la convención
//   cromos/<file>          -> cromos/thumb/<file>
//   <carpeta>/<file>       -> <carpeta>/thumb/<file>
// Genera los thumbs con scripts/generate-thumbnails.mjs.
export function getThumbUrl(path: string, bucket: string = DEFAULT_BUCKET): string {
  const lastSlash = path.lastIndexOf('/');
  const thumbPath =
    lastSlash === -1
      ? `thumb/${path}`
      : `${path.slice(0, lastSlash)}/thumb/${path.slice(lastSlash + 1)}`;
  return getStorageUrl(thumbPath, bucket);
}

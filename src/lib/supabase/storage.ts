const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'solarhub-assets';

// Avatar compartido que se sirve cuando un perfil no tiene imagen propia.
// Vive en la raíz de profiles/ (lo sube el service role); las políticas RLS
// impiden que un usuario lo sobrescriba o borre desde el cliente.
export const DEFAULT_AVATAR_PATH = 'profiles/default_profile.webp';

// Construye la URL pública sin instanciar un cliente de Supabase, así
// se puede llamar tanto desde server como desde client components.
export function getStorageUrl(path: string, bucket: string = STORAGE_BUCKET): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// Devuelve la URL del thumbnail siguiendo la convención
//   cromos/<file>          -> cromos/thumb/<file>
//   <carpeta>/<file>       -> <carpeta>/thumb/<file>
// Genera los thumbs con scripts/generate-thumbnails.mjs.
export function getThumbUrl(path: string, bucket: string = STORAGE_BUCKET): string {
  const lastSlash = path.lastIndexOf('/');
  const thumbPath =
    lastSlash === -1
      ? `thumb/${path}`
      : `${path.slice(0, lastSlash)}/thumb/${path.slice(lastSlash + 1)}`;
  return getStorageUrl(thumbPath, bucket);
}

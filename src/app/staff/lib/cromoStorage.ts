import "server-only";
import { slugify } from "@/app/(app)/cromos/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        opts: { contentType: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export const STORAGE_BUCKET = "solarhub-assets";

export interface CromoImagePaths {
  front: string;
  back: string;
}

// Construye rutas únicas (slug + timestamp) para las dos imágenes de un cromo.
export function buildCromoImagePaths(name: string): CromoImagePaths {
  const base = `${slugify(name) || "cromo"}-${Date.now()}`;
  return {
    front: `cromos/${base}.webp`,
    back: `cromos/${base}-back.webp`,
  };
}

// Construye una ruta única para una sola imagen (frente o dorso) durante un update.
export function buildSingleCromoImagePath(name: string, side: "front" | "back"): string {
  const base = `${slugify(name) || "cromo"}-${Date.now()}`;
  return side === "back" ? `cromos/${base}-back.webp` : `cromos/${base}.webp`;
}

export async function uploadCromoWebp(
  supabase: StorageClient,
  path: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.type !== "image/webp") {
    return { ok: false, error: "La imagen debe ser .webp." };
  }
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: "image/webp", upsert: false });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Borra ficheros del bucket sin propagar errores. Usa el admin client para que
// el cleanup funcione aunque el cliente normal ya no tenga permisos sobre el
// path (p.ej. tras un rollback con la sesión a medias).
export async function safeRemoveFromBucket(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await createSupabaseAdminClient()
    .storage.from(STORAGE_BUCKET)
    .remove(paths)
    .catch(() => {});
}

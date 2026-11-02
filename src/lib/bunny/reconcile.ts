// Aplica a la fila de map_media el estado real del vídeo en Bunny. Siempre
// consulta a Bunny (fetch-back) en vez de fiarse de un payload, así que el
// orden de llegada de los webhooks y sus reintentos dan igual.
//
// Sin server-only: las dependencias llegan inyectadas. La usan el webhook,
// syncVideoStatusAction y los scripts de scripts/bunny/.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getVideo, type BunnyApiConfig } from "./api";
import { mapBunnyVideo, type BunnyVideo, type VideoStatus } from "./status";

export interface ReconcileDeps {
  getVideo: (guid: string) => Promise<BunnyVideo | null>;
  findRowByGuid: (guid: string) => Promise<{ id: number } | null>;
  updateRow: (
    id: number,
    patch: { video_status: VideoStatus; duration_s: number | null },
  ) => Promise<void>;
  deleteRow: (id: number) => Promise<void>;
}

export type ReconcileResult = "updated" | "unchanged" | "deleted" | "not_found";

export async function reconcileVideo(deps: ReconcileDeps, guid: string): Promise<ReconcileResult> {
  const row = await deps.findRowByGuid(guid);
  if (!row) return "not_found";

  // Los errores de Bunny se propagan: el webhook responde 500 y Bunny reintenta.
  const video = await deps.getVideo(guid);
  if (!video) {
    await deps.deleteRow(row.id);
    return "deleted";
  }

  const mapped = mapBunnyVideo(video);
  if (!mapped) return "unchanged";

  await deps.updateRow(row.id, { video_status: mapped.status, duration_s: mapped.durationS });
  return "updated";
}

/**
 * Dependencias reales: Bunny vía api.ts y map_media vía un cliente con
 * service_role (el trigger de la tabla solo deja a ese rol tocar el estado).
 */
export function createReconcileDeps(admin: SupabaseClient, cfg: BunnyApiConfig): ReconcileDeps {
  return {
    getVideo: (guid) => getVideo(cfg, guid),
    findRowByGuid: async (guid) => {
      const { data, error } = await admin
        .from("map_media")
        .select("id")
        .eq("bunny_video_id", guid)
        .maybeSingle<{ id: number }>();
      if (error) throw new Error(`map_media lookup: ${error.message}`);
      return data;
    },
    updateRow: async (id, patch) => {
      const { error } = await admin.from("map_media").update(patch).eq("id", id);
      if (error) throw new Error(`map_media update: ${error.message}`);
    },
    deleteRow: async (id) => {
      const { error } = await admin.from("map_media").delete().eq("id", id);
      if (error) throw new Error(`map_media delete: ${error.message}`);
    },
  };
}

// =====================================================================
// migrate-videos.ts
// Pasa los vídeos legados de Supabase Storage a Bunny Stream.
//
// Uso:
//   pnpm bunny:migrate            → dry-run: solo cuenta lo que haría
//   pnpm bunny:migrate --apply    → ejecuta
//
// Idempotente: está pensado para ejecutarse dos veces.
//   1ª pasada: sube a Bunny cada vídeo legado (fila VIDEO con path y sin
//              bunny_video_id) y lo marca PROCESSING, sin tocar path: hasta
//              que Bunny lo deja READY se sigue sirviendo desde Storage.
//   2ª pasada (cuando Bunny haya terminado): reconcilia el estado y, si ya
//              está READY, borra el fichero de Storage y pone path = null.
//
// Un vídeo legado que Bunny marca FAILED (p. ej. más de 60 s) conserva su
// path y se sigue reproduciendo desde Storage; se lista para revisarlo.
// =====================================================================

import { createVideo, deleteVideo, uploadVideoBinary } from "@/lib/bunny/api";
import { createReconcileDeps, reconcileVideo, type ReconcileDeps } from "@/lib/bunny/reconcile";
import type { VideoStatus } from "@/lib/bunny/status";
import { APPLY, STORAGE_BUCKET, errorMessage, loadScriptContext } from "./env";

const { admin, bunny } = loadScriptContext("migrate-videos");

const counters = {
  legacyFound: 0,
  uploaded: 0,
  uploadErrors: 0,
  dualFound: 0,
  storageFreed: 0,
  stillProcessing: 0,
  failedKeptInStorage: 0,
  revertedToLegacy: 0,
  finalizeErrors: 0,
};

async function uploadLegacyVideos(): Promise<void> {
  const { data: rows, error } = await admin
    .from("map_media")
    .select("id, pin_id, path")
    .eq("type", "VIDEO")
    .is("bunny_video_id", null)
    .not("path", "is", null)
    .order("id")
    .returns<Array<{ id: number; pin_id: number; path: string }>>();
  if (error) throw new Error(`Listado de vídeos legados: ${error.message}`);

  console.log(`1. Vídeos legados sin migrar: ${rows.length}`);
  for (const row of rows) {
    counters.legacyFound++;
    if (!APPLY) {
      console.log(`   · subiría map_media ${row.id} (${row.path})`);
      continue;
    }

    let guid: string | null = null;
    try {
      const { data: blob, error: dlErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .download(row.path);
      if (dlErr || !blob) throw new Error(`descarga: ${dlErr?.message ?? "sin datos"}`);

      ({ guid } = await createVideo(bunny, `pin-${row.pin_id}-legacy-${row.id}`));
      await uploadVideoBinary(bunny, guid, await blob.arrayBuffer());

      const { error: upErr } = await admin
        .from("map_media")
        .update({ bunny_video_id: guid, video_status: "PROCESSING" })
        .eq("id", row.id)
        .is("bunny_video_id", null);
      if (upErr) throw new Error(`update: ${upErr.message}`);

      counters.uploaded++;
      console.log(`   ✓ map_media ${row.id} → ${guid}`);
    } catch (err) {
      counters.uploadErrors++;
      console.error(`   ✗ map_media ${row.id}: ${errorMessage(err)}`);
      // Compensación: que no quede en Bunny un vídeo sin fila.
      if (guid) {
        await deleteVideo(bunny, guid).catch((e) =>
          console.error(`     (no se pudo borrar ${guid} de Bunny: ${errorMessage(e)})`),
        );
      }
    }
  }
}

async function finalizeMigratedVideos(): Promise<void> {
  const { data: rows, error } = await admin
    .from("map_media")
    .select("id, path, bunny_video_id")
    .not("bunny_video_id", "is", null)
    .not("path", "is", null)
    .order("id")
    .returns<Array<{ id: number; path: string; bunny_video_id: string }>>();
  if (error) throw new Error(`Listado de vídeos a medio migrar: ${error.message}`);

  console.log(`\n2. Vídeos en Bunny que aún conservan el fichero de Storage: ${rows.length}`);
  const real = createReconcileDeps(admin, bunny);

  for (const row of rows) {
    counters.dualFound++;
    // Lo que decide reconcileVideo, capturado desde las dependencias.
    const outcome: { status: VideoStatus | null; reverted: boolean } = {
      status: null,
      reverted: false,
    };

    const deps: ReconcileDeps = {
      ...real,
      updateRow: async (id, patch) => {
        outcome.status = patch.video_status;
        if (APPLY) await real.updateRow(id, patch);
      },
      // Si Bunny ya no tiene el vídeo, la fila vuelve a ser un vídeo legado
      // en vez de borrarse: el fichero de Storage sigue ahí.
      deleteRow: async (id) => {
        outcome.reverted = true;
        if (!APPLY) return;
        const { error: revErr } = await admin
          .from("map_media")
          .update({ bunny_video_id: null, video_status: null, duration_s: null })
          .eq("id", id);
        if (revErr) throw new Error(`revertir a legado: ${revErr.message}`);
      },
    };

    try {
      await reconcileVideo(deps, row.bunny_video_id);
      const { status } = outcome;
      if (outcome.reverted) {
        counters.revertedToLegacy++;
        console.log(`   ↺ map_media ${row.id}: Bunny no tiene ${row.bunny_video_id}; vuelve a legado`);
        continue;
      }

      if (status === "READY") {
        if (APPLY) {
          const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET).remove([row.path]);
          if (rmErr) throw new Error(`borrado en Storage: ${rmErr.message}`);
          const { error: upErr } = await admin
            .from("map_media")
            .update({ path: null })
            .eq("id", row.id);
          if (upErr) throw new Error(`update path: ${upErr.message}`);
        }
        counters.storageFreed++;
        console.log(`   ${APPLY ? "✓" : "·"} map_media ${row.id}: READY → ${APPLY ? "" : "se "}libera ${row.path}`);
      } else if (status === "FAILED") {
        counters.failedKeptInStorage++;
        console.log(`   ! map_media ${row.id}: Bunny lo marca FAILED; se sigue sirviendo desde Storage`);
      } else {
        counters.stillProcessing++;
        console.log(`   … map_media ${row.id}: ${status ?? "sin cambios"}; vuelve a ejecutar más tarde`);
      }
    } catch (err) {
      counters.finalizeErrors++;
      console.error(`   ✗ map_media ${row.id}: ${errorMessage(err)}`);
    }
  }
}

async function main(): Promise<void> {
  await uploadLegacyVideos();
  await finalizeMigratedVideos();

  console.log("\nResumen");
  console.log(`  Vídeos legados encontrados:          ${counters.legacyFound}`);
  console.log(`  Subidos a Bunny:                     ${counters.uploaded}`);
  console.log(`  Errores al subir:                    ${counters.uploadErrors}`);
  console.log(`  A medio migrar encontrados:          ${counters.dualFound}`);
  console.log(`  Ficheros de Storage liberados:       ${counters.storageFreed}`);
  console.log(`  Todavía procesándose:                ${counters.stillProcessing}`);
  console.log(`  FAILED en Bunny (siguen en Storage): ${counters.failedKeptInStorage}`);
  console.log(`  Revertidos a legado:                 ${counters.revertedToLegacy}`);
  console.log(`  Errores al finalizar:                ${counters.finalizeErrors}`);
  if (!APPLY) console.log("\nDry-run: no se ha modificado nada. Añade --apply para ejecutar.");

  if (counters.uploadErrors + counters.finalizeErrors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});

// =====================================================================
// cleanup.ts
// Limpia restos de subidas de vídeo a Bunny Stream.
//
// Uso:
//   pnpm bunny:cleanup            → dry-run: solo lista lo que borraría
//   pnpm bunny:cleanup --apply    → ejecuta
//
//   1. Filas UPLOADING de más de 24 h (subidas abandonadas) y filas FAILED
//      de más de 7 días: borra la fila y el vídeo de Bunny. Las que aún
//      conservan path (vídeos legados a medio migrar) no se tocan: se
//      siguen sirviendo desde Storage y se listan para revisarlas.
//   2. Vídeos de la library sin fila en map_media y con más de 24 h:
//      restos de borrados en los que Bunny falló, o de compensaciones.
//
// Ojo: compara la BD de .env.local con la library de .env.local. Si fueran
// de entornos distintos, el paso 2 vería todos los vídeos como huérfanos;
// por eso la cabecera imprime ambos y el modo por defecto es dry-run.
// =====================================================================

import { deleteVideo, listVideos } from "@/lib/bunny/api";
import { STALE_UPLOAD_MS } from "@/lib/bunny/constants";
import type { BunnyVideo, VideoStatus } from "@/lib/bunny/status";
import { APPLY, errorMessage, loadScriptContext } from "./env";

const FAILED_RETENTION_MS = 7 * 24 * 3600 * 1000;
const ORPHAN_MIN_AGE_MS = 24 * 3600 * 1000;
const PAGE_SIZE = 100;

const { admin, bunny } = loadScriptContext("cleanup");

const counters = {
  staleRows: 0,
  rowsDeleted: 0,
  rowsSkippedWithPath: 0,
  orphans: 0,
  orphansDeleted: 0,
  errors: 0,
};

interface StaleRow {
  id: number;
  path: string | null;
  bunny_video_id: string;
  video_status: VideoStatus;
  created_at: string;
}

async function cleanStaleRows(now: number): Promise<void> {
  const uploadingBefore = new Date(now - STALE_UPLOAD_MS).toISOString();
  const failedBefore = new Date(now - FAILED_RETENTION_MS).toISOString();

  const { data: rows, error } = await admin
    .from("map_media")
    .select("id, path, bunny_video_id, video_status, created_at")
    .or(
      `and(video_status.eq.UPLOADING,created_at.lt.${uploadingBefore}),` +
        `and(video_status.eq.FAILED,created_at.lt.${failedBefore})`,
    )
    .order("id")
    .returns<StaleRow[]>();
  if (error) throw new Error(`Listado de filas caducadas: ${error.message}`);

  console.log(`1. Filas UPLOADING > 24 h o FAILED > 7 días: ${rows.length}`);
  for (const row of rows) {
    counters.staleRows++;
    if (row.path) {
      counters.rowsSkippedWithPath++;
      console.log(`   ! map_media ${row.id} (${row.video_status}) conserva ${row.path}: se deja para revisión`);
      continue;
    }
    if (!APPLY) {
      console.log(`   · borraría map_media ${row.id} (${row.video_status}) y ${row.bunny_video_id}`);
      continue;
    }
    try {
      // Primero la BD (lo autoritativo); después Bunny, idempotente.
      const { error: delErr } = await admin.from("map_media").delete().eq("id", row.id);
      if (delErr) throw new Error(`delete: ${delErr.message}`);
      await deleteVideo(bunny, row.bunny_video_id);
      counters.rowsDeleted++;
      console.log(`   ✓ map_media ${row.id} (${row.video_status}) y ${row.bunny_video_id}`);
    } catch (err) {
      counters.errors++;
      console.error(`   ✗ map_media ${row.id}: ${errorMessage(err)}`);
    }
  }
}

// Bunny envía dateUploaded en UTC sin zona ("2026-11-02T10:00:00.123").
function uploadedAt(video: BunnyVideo): number | null {
  if (!video.dateUploaded) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(video.dateUploaded)
    ? video.dateUploaded
    : `${video.dateUploaded}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

async function cleanOrphanVideos(now: number): Promise<void> {
  const { data: rows, error } = await admin
    .from("map_media")
    .select("bunny_video_id")
    .not("bunny_video_id", "is", null)
    .returns<Array<{ bunny_video_id: string }>>();
  if (error) throw new Error(`Listado de vídeos con fila: ${error.message}`);
  const known = new Set(rows.map((r) => r.bunny_video_id.toLowerCase()));

  // Se recorre el listado entero antes de borrar nada: borrar mientras se
  // pagina desplazaría las páginas y se saltarían vídeos.
  const orphans: BunnyVideo[] = [];
  for (let page = 1; ; page++) {
    const { items, totalItems } = await listVideos(bunny, page, PAGE_SIZE);
    for (const video of items) {
      const at = uploadedAt(video);
      if (known.has(video.guid.toLowerCase())) continue;
      if (at === null || now - at < ORPHAN_MIN_AGE_MS) continue;
      orphans.push(video);
    }
    if (items.length === 0 || page * PAGE_SIZE >= totalItems) break;
  }

  console.log(`\n2. Vídeos de Bunny sin fila y con más de 24 h: ${orphans.length}`);
  for (const video of orphans) {
    counters.orphans++;
    if (!APPLY) {
      console.log(`   · borraría ${video.guid} (subido ${video.dateUploaded})`);
      continue;
    }
    try {
      await deleteVideo(bunny, video.guid);
      counters.orphansDeleted++;
      console.log(`   ✓ ${video.guid}`);
    } catch (err) {
      counters.errors++;
      console.error(`   ✗ ${video.guid}: ${errorMessage(err)}`);
    }
  }
}

async function main(): Promise<void> {
  const now = Date.now();
  await cleanStaleRows(now);
  await cleanOrphanVideos(now);

  console.log("\nResumen");
  console.log(`  Filas caducadas encontradas:       ${counters.staleRows}`);
  console.log(`  Filas (y vídeos) borradas:         ${counters.rowsDeleted}`);
  console.log(`  Filas con path dejadas a revisión: ${counters.rowsSkippedWithPath}`);
  console.log(`  Vídeos huérfanos encontrados:      ${counters.orphans}`);
  console.log(`  Vídeos huérfanos borrados:         ${counters.orphansDeleted}`);
  console.log(`  Errores:                           ${counters.errors}`);
  if (!APPLY) console.log("\nDry-run: no se ha modificado nada. Añade --apply para ejecutar.");

  if (counters.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});

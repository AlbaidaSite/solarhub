// =====================================================================
// generate-thumbnails.mjs
// Recorre el bucket de Supabase, busca .webp en cromos/ que NO estén ya
// en cromos/thumb/, los redimensiona a 400px de ancho y los sube como
// cromos/thumb/<mismo-nombre>.
//
// Uso:
//   npm run generate-thumbnails
//   (necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
//    en .env.development — el script se lanza con node --env-file=.env.development)
//
// Idempotente: si el thumb ya existe, salta esa imagen.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";
const SOURCE_FOLDER = "cromos";
const THUMB_FOLDER = "cromos/thumb";
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 75;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.development"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function listExistingThumbs() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(THUMB_FOLDER, { limit: 1000 });
  if (error) {
    // Si la carpeta thumb/ aún no existe, list() devuelve error o vacío.
    // En ambos casos asumimos "ningún thumb generado".
    return new Set();
  }
  return new Set((data ?? []).map((f) => f.name));
}

async function listSourceImages() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(SOURCE_FOLDER, { limit: 1000 });
  if (error) throw error;
  return (data ?? []).filter(
    (f) =>
      // Excluir la "carpeta" thumb (que aparece como entry sin id) y
      // archivos no-webp (defensivo, aunque tu pipeline use webp).
      f.name !== "thumb" &&
      /\.webp$/i.test(f.name)
  );
}

async function processOne(filename, existingThumbs) {
  if (existingThumbs.has(filename)) {
    console.log(`  · skip (ya existe): ${filename}`);
    return { skipped: true };
  }

  const sourcePath = `${SOURCE_FOLDER}/${filename}`;
  const thumbPath = `${THUMB_FOLDER}/${filename}`;

  // Descargar
  const { data: blob, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(sourcePath);
  if (dlErr) throw new Error(`download ${sourcePath}: ${dlErr.message}`);

  const buffer = Buffer.from(await blob.arrayBuffer());

  // Redimensionar
  const thumb = await sharp(buffer)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();

  // Subir
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumb, {
      contentType: "image/webp",
      upsert: false,
    });
  if (upErr) throw new Error(`upload ${thumbPath}: ${upErr.message}`);

  console.log(
    `  ✓ ${filename}  (${(buffer.length / 1024).toFixed(0)} KB → ${(
      thumb.length / 1024
    ).toFixed(0)} KB)`
  );
  return { skipped: false };
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Origen: ${SOURCE_FOLDER}/   Destino: ${THUMB_FOLDER}/\n`);

  const [existingThumbs, sources] = await Promise.all([
    listExistingThumbs(),
    listSourceImages(),
  ]);

  console.log(`Encontradas ${sources.length} imágenes fuente`);
  console.log(`Ya existen ${existingThumbs.size} thumbnails\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of sources) {
    try {
      const res = await processOne(file.name, existingThumbs);
      if (res.skipped) skipped++;
      else created++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${file.name}: ${err.message}`);
    }
  }

  console.log(`\nResumen: ${created} creados, ${skipped} ya existían, ${failed} fallidos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

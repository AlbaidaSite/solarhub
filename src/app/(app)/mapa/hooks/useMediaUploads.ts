"use client";

// Subida de la multimedia de un pin, compartida por el alta (NewPinForm) y
// la edición (EditPinForm). El pin tiene que existir antes: map_media
// necesita su id.
//
//   · Fotos: en paralelo a Supabase Storage y después addMapMediaAction,
//     igual que antes.
//   · Vídeos: de uno en uno, directos del navegador a Bunny Stream por TUS.
//     createVideoUploadAction crea la fila (UPLOADING) y firma la subida;
//     si la subida falla del todo, abortVideoUploadAction borra la fila.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { BUNNY_TUS_ENDPOINT, TUS_RETRY_DELAYS_MS } from "@/lib/bunny/constants";
import { videoMimeType } from "@/lib/media/videoValidation";
import { addMapMediaAction } from "../actions";
import type { MediaItemToInsert } from "../actions";
import {
  abortVideoUploadAction,
  createVideoUploadAction,
  syncVideoStatusAction,
} from "../video-actions";
import type { MediaEntry } from "../nueva/components/MediaSection";

export type EntryUploadStatus =
  | { kind: "idle" }
  /** progress: 0–100 en vídeos; null en fotos (Storage no informa del avance). */
  | { kind: "uploading"; progress: number | null }
  /** El vídeo ya está en Bunny y se está consultando su estado. */
  | { kind: "processing" }
  | { kind: "ok" }
  | { kind: "error"; msg: string };

export interface UploadFailure {
  clientId: string;
  name: string;
  msg: string;
}

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

const VIDEO_UPLOAD_ERROR = "No se ha podido subir el vídeo. Revisa la conexión y reinténtalo.";

function mimeToExt(blob: Blob, originalName: string): string {
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("gif")) return "gif";
  return originalName.split(".").pop() ?? "bin";
}

async function uploadPhoto(
  pinId: number,
  entry: MediaEntry
): Promise<{ path: string; mimeType: string; size: number } | { error: string }> {
  const blob = entry.processedBlob!;
  const ext = mimeToExt(blob, entry.originalName);
  const storagePath = `map-media/${pinId}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { contentType: blob.type, upsert: false });

  if (error) return { error: error.message };
  return { path: data.path, mimeType: blob.type, size: blob.size };
}

interface TusAuth {
  videoId: string;
  libraryId: string;
  title: string;
  expires: number;
  signature: string;
}

async function uploadToBunny(
  file: Blob,
  auth: TusAuth,
  mimeType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  // Import dinámico: tus-js-client solo hace falta cuando hay vídeos.
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: BUNNY_TUS_ENDPOINT,
      retryDelays: TUS_RETRY_DELAYS_MS,
      headers: {
        AuthorizationSignature: auth.signature,
        AuthorizationExpire: String(auth.expires),
        VideoId: auth.videoId,
        LibraryId: auth.libraryId,
      },
      metadata: { filetype: mimeType, title: auth.title },
      removeFingerprintOnSuccess: true,
      onProgress: (sent, total) => onProgress(total > 0 ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
      onError: (err) => reject(err),
    });
    upload.start();
  });
}

export function useMediaUploads() {
  const [statuses, setStatuses] = useState<Record<string, EntryUploadStatus>>({});
  const [isUploading, setIsUploading] = useState(false);

  const setStatus = useCallback((clientId: string, status: EntryUploadStatus) => {
    setStatuses((prev) => ({ ...prev, [clientId]: status }));
  }, []);

  // Cerrar o recargar la pestaña a mitad cortaría la subida: se avisa.
  useEffect(() => {
    if (!isUploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isUploading]);

  const uploadVideo = useCallback(
    async (pinId: number, entry: MediaEntry): Promise<string | null> => {
      setStatus(entry.clientId, { kind: "uploading", progress: 0 });
      const file = entry.processedBlob!;
      const mimeType = videoMimeType({ type: file.type, name: entry.originalName });

      let created;
      try {
        created = await createVideoUploadAction({
          pinId,
          sizeBytes: file.size,
          durationS: entry.durationS ?? null,
          mimeType,
        });
      } catch {
        return VIDEO_UPLOAD_ERROR;
      }
      if (!created.ok) return created.error;

      try {
        await uploadToBunny(file, created, mimeType, (progress) =>
          setStatus(entry.clientId, { kind: "uploading", progress })
        );
      } catch {
        // Fallo definitivo tras los reintentos de TUS: fuera la fila
        // UPLOADING (y el vídeo vacío de Bunny). "Reintentar" empieza de cero.
        await abortVideoUploadAction(created.mediaId).catch(() => undefined);
        return VIDEO_UPLOAD_ERROR;
      }

      setStatus(entry.clientId, { kind: "processing" });
      // Primera consulta del estado; si falla da igual: el webhook o el
      // polling del detalle del pin lo pondrán al día.
      await syncVideoStatusAction(created.mediaId).catch(() => undefined);
      return null;
    },
    [setStatus]
  );

  const runUploadRound = useCallback(
    async (pinId: number, entries: MediaEntry[]): Promise<UploadFailure[]> => {
      setIsUploading(true);
      try {
        const photos = entries.filter((e) => e.mediaType === "PHOTO");
        const videos = entries.filter((e) => e.mediaType === "VIDEO");

        setStatuses((prev) => {
          const next = { ...prev };
          for (const e of photos) next[e.clientId] = { kind: "uploading", progress: null };
          for (const e of videos) next[e.clientId] = { kind: "idle" };
          return next;
        });

        const failures: UploadFailure[] = [];
        const fail = (entry: MediaEntry, msg: string) => {
          failures.push({ clientId: entry.clientId, name: entry.originalName, msg });
          setStatus(entry.clientId, { kind: "error", msg });
        };

        // 1. Fotos, en paralelo.
        const settled = await Promise.allSettled(photos.map((entry) => uploadPhoto(pinId, entry)));
        const toInsert: MediaItemToInsert[] = [];
        for (let i = 0; i < photos.length; i++) {
          const entry = photos[i];
          const result = settled[i];
          if (result.status === "fulfilled" && "path" in result.value) {
            const { path, mimeType, size } = result.value;
            toInsert.push({ path, type: "PHOTO", mimeType, size });
            setStatus(entry.clientId, { kind: "ok" });
          } else {
            fail(
              entry,
              result.status === "rejected"
                ? String(result.reason)
                : (result.value as { error: string }).error
            );
          }
        }
        if (toInsert.length > 0) {
          await addMapMediaAction(pinId, toInsert);
        }

        // 2. Vídeos, de uno en uno: varios a la vez se repartirían una
        //    conexión móvil y tardarían lo mismo en terminar todos.
        for (const entry of videos) {
          const error = await uploadVideo(pinId, entry);
          if (error) fail(entry, error);
          else setStatus(entry.clientId, { kind: "ok" });
        }

        return failures;
      } finally {
        setIsUploading(false);
      }
    },
    [setStatus, uploadVideo]
  );

  return { statuses, isUploading, runUploadRound };
}

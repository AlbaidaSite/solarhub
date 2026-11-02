"use client";

import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import type { EntryUploadStatus } from "../../hooks/useMediaUploads";
import type { MediaEntry } from "./MediaSection";

// Estado de cada archivo en la pantalla "Guardando…" del alta y de la
// edición de un pin (ver useMediaUploads).
export default function UploadStatusList({
  entries,
  statuses,
}: {
  entries: MediaEntry[];
  statuses: Record<string, EntryUploadStatus>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => {
        const status = statuses[entry.clientId];
        return (
          <div
            key={entry.clientId}
            className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10"
          >
            {!status || status.kind === "idle" ? (
              <Upload size={16} className="text-white/30 shrink-0" />
            ) : status.kind === "uploading" || status.kind === "processing" ? (
              <Loader2 size={16} className="text-amber-300 animate-spin shrink-0" />
            ) : status.kind === "ok" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{entry.originalName}</p>
              {status?.kind === "idle" && entry.mediaType === "VIDEO" && (
                <p className="text-xs text-white/40 mt-0.5">En cola</p>
              )}
              {status?.kind === "uploading" && status.progress !== null && (
                <p className="text-xs text-amber-300 mt-0.5">Subiendo {status.progress} %</p>
              )}
              {status?.kind === "processing" && (
                <p className="text-xs text-amber-300 mt-0.5">Procesando el vídeo…</p>
              )}
              {status?.kind === "error" && (
                <p className="text-xs text-red-400 mt-0.5">{status.msg}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

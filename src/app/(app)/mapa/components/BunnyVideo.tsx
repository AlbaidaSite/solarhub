"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";
import {
  PROCESSING_POLL_INTERVAL_MS,
  PROCESSING_POLL_MAX_MS,
} from "@/lib/bunny/constants";
import type { VideoDisplay } from "@/lib/media/videoDisplay";
import { getVideoEmbedUrlAction, syncVideoStatusAction } from "../video-actions";

interface BunnyVideoProps {
  mediaId: number;
  thumbnailUrl: string | null;
  /** Estado calculado por quien lo pinta (videoDisplayState). */
  initialDisplay: VideoDisplay;
  title: string;
}

const MAX_POLLS = Math.floor(PROCESSING_POLL_MAX_MS / PROCESSING_POLL_INTERVAL_MS);

// Vídeo de un pin alojado en Bunny Stream. Hasta que se pulsa play solo hay
// una miniatura: la URL firmada del reproductor se pide en ese momento, para
// que el token no caduque con el modal abierto.
export default function BunnyVideo({ mediaId, thumbnailUrl, initialDisplay, title }: BunnyVideoProps) {
  // El polling sustituye al estado inicial en cuanto responde.
  const [polledDisplay, setPolledDisplay] = useState<VideoDisplay | null>(null);
  const display = polledDisplay ?? initialDisplay;

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mientras se procesa, se consulta el estado cada pocos segundos (con un
  // máximo): en local y en previews no llega el webhook de Bunny.
  useEffect(() => {
    if (display !== "processing") return;
    let cancelled = false;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      if (polls >= MAX_POLLS) clearInterval(timer);
      try {
        const result = await syncVideoStatusAction(mediaId);
        if (!cancelled && result.ok) setPolledDisplay(result.display);
      } catch {
        // Fallo puntual: lo reintenta el siguiente ciclo.
      }
    }, PROCESSING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [display, mediaId]);

  const handlePlay = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getVideoEmbedUrlAction(mediaId);
      if (result.ok) setEmbedUrl(result.url);
      else setError(result.error);
    } catch {
      setError("No se ha podido cargar el vídeo.");
    } finally {
      setIsLoading(false);
    }
  };

  if (display === "hidden") return null;

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
      {display === "playable" && embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      )}

      {display === "playable" && !embedUrl && (
        <>
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura del CDN de Bunny: <img> plano para no gastar la optimización de imágenes de Vercel.
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
            <button
              type="button"
              onClick={handlePlay}
              disabled={isLoading}
              aria-label="Reproducir vídeo"
              className="w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white hover:text-amber-300 transition-colors cursor-pointer disabled:cursor-wait"
            >
              {isLoading ? (
                <Loader2 size={28} className="animate-spin" />
              ) : (
                <Play size={28} className="translate-x-0.5" />
              )}
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-300 bg-black/70 rounded-lg px-3 py-1">
                {error}
              </p>
            )}
          </div>
        </>
      )}

      {display === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-zinc-900">
          <Loader2 size={22} className="text-amber-300 animate-spin" />
          <span className="text-sm text-white/70">Procesando vídeo…</span>
        </div>
      )}

      {display === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900 px-6 text-center">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm text-white/70">
            No se ha podido procesar el vídeo (formato no válido o más de 60 s). Edita la
            pegatina para eliminarlo y volver a subirlo.
          </p>
        </div>
      )}
    </div>
  );
}

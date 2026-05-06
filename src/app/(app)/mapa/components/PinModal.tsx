"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, X } from "lucide-react";
import type { PinDetail } from "@/types/map";

interface PinModalProps {
  detail: PinDetail;
  onClose: () => void;
}

export default function PinModal({ detail, onClose }: PinModalProps) {
  const { pin, countryName, username, sticker, media } = detail;
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  // Escape cierra el modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloquear scroll del fondo mientras esté abierto
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  const activeMedia = media[activeMediaIdx];

  // Construir línea "Place, State, CountryName"
  const locationLine = [pin.place, pin.state, countryName].filter(Boolean).join(", ");

  const mapsUrl = `https://www.google.com/maps/place/${pin.latitude},${pin.longitude}`;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto md:overflow-hidden scrollbar-clean"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar"
        className="absolute top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <X size={35} />
      </button>

      <div
        className="min-h-full md:h-full w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-8 px-6 pt-32 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Columna izquierda: visor de medios + carrusel */}
        <div className="md:w-1/2 flex flex-col gap-4 min-h-0">
          <div className="relative w-full aspect-square bg-zinc-900 rounded-xl overflow-hidden border border-white/10">
            {activeMedia ? (
              activeMedia.type === "PHOTO" ? (
                <Image
                  key={activeMedia.id}
                  src={activeMedia.url}
                  alt={pin.place}
                  fill
                  sizes="(max-width: 768px) 80vw, 40vw"
                  className="object-contain"
                  priority
                  unoptimized
                />
              ) : (
                <video
                  key={activeMedia.id}
                  src={activeMedia.url}
                  controls
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                Sin contenido multimedia
              </div>
            )}
          </div>

          {/* Carrusel de miniaturas */}
          {media.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-clean pb-1">
              {media.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMediaIdx(idx)}
                  aria-label={`Ver ${m.type === "PHOTO" ? "foto" : "vídeo"} ${idx + 1}`}
                  className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-zinc-900 ${
                    idx === activeMediaIdx
                      ? "border-amber-300"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {m.type === "PHOTO" ? (
                    <Image
                      src={m.url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <>
                      <video
                        src={m.url}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[12px] border-l-white ml-1" />
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha: información */}
        <div className="md:w-1/2 flex flex-col gap-5 min-h-0">
          {/* Sticker */}
          {sticker && (
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 shrink-0">
                <Image
                  src={sticker.icon_path}
                  alt={sticker.name}
                  fill
                  sizes="64px"
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className="text-xl font-bold text-white">{sticker.name}</span>
            </div>
          )}

          {/* Ubicación */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">
              Ubicación
            </span>
            <p className="text-lg text-white">{locationLine}</p>
          </div>

          {/* Usuario */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">
              Compartido por
            </span>
            <p className="text-lg text-amber-300 font-semibold">{username}</p>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">
              Fecha
            </span>
            <p className="text-base text-white">
              {new Date(pin.created_at).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Enlace a Google Maps */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-sm font-semibold transition-colors"
          >
            <ExternalLink size={16} />
            Ver en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

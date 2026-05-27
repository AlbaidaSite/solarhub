"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";
import type { PinDetail } from "@/types/map";
import { checkPinEditPermissionAction, deletePinAction } from "../actions";

interface PinModalProps {
  detail: PinDetail;
  onClose: () => void;
  onDelete?: () => void;
}

type DeleteStep = null | "confirm1" | "confirm2";

export default function PinModal({ detail, onClose, onDelete }: PinModalProps) {
  const router = useRouter();
  const { pin, countryName, username, sticker, media } = detail;
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [canEdit, setCanEdit] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check if current user can edit/delete this pin
  useEffect(() => {
    checkPinEditPermissionAction(pin.id).then(setCanEdit);
  }, [pin.id]);

  // Escape closes the modal (unless a delete confirmation is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteStep !== null) {
          setDeleteStep(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, deleteStep]);

  // Lock background scroll while open
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  const handleDelete = () => {
    startTransition(async () => {
      setDeleteError(null);
      const result = await deletePinAction(pin.id);
      if (result.ok) {
        onDelete?.();
      } else {
        setDeleteError(result.error);
        setDeleteStep(null);
      }
    });
  };

  const activeMedia = media[activeMediaIdx];
  const locationLine = [pin.place, pin.state, countryName].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/place/${pin.latitude},${pin.longitude}`;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto md:overflow-hidden scrollbar-clean"
      onClick={onClose}
    >
      {/* Close button — top-left */}
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

      {/* Edit / Delete buttons — top-right (only for owners / staff) */}
      {canEdit && (
        <div
          className="absolute top-32 right-6 z-10 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => router.push(`/mapa/editar/${pin.id}`)}
            aria-label="Editar pegatina"
            title="Editar"
            className="p-2 rounded-full text-white/60 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Pencil size={22} />
          </button>
          <button
            type="button"
            onClick={() => { setDeleteError(null); setDeleteStep("confirm1"); }}
            aria-label="Eliminar pegatina"
            title="Eliminar"
            className="p-2 rounded-full text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Trash2 size={22} />
          </button>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteStep !== null && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-900 border border-white/15 rounded-2xl p-6 w-80 flex flex-col gap-5 shadow-2xl mx-4">
            <p className="text-white font-semibold">
              {deleteStep === "confirm1"
                ? "¿Eliminar esta pegatina?"
                : "Esta acción no se puede deshacer."}
            </p>
            {deleteStep === "confirm2" && (
              <p className="text-white/50 text-sm -mt-2">
                Se borrarán también todos los archivos multimedia adjuntos.
              </p>
            )}
            {deleteError && (
              <p className="text-red-400 text-sm">{deleteError}</p>
            )}
            <div className="flex gap-3">
              {deleteStep === "confirm1" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteStep("confirm2")}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(null)}
                    className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(null)}
                    disabled={isPending}
                    className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Eliminando…" : "Confirmar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="min-h-full md:h-full w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-8 px-6 pt-32 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left column: media viewer + carousel */}
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

          {media.length > 1 && (
            <div className="flex flex-wrap gap-2 scrollbar-clean pb-1">
              {media.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMediaIdx(idx)}
                  aria-label={`Ver ${m.type === "PHOTO" ? "foto" : "vídeo"} ${idx + 1}`}
                  className={`relative shrink-0 w-15 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-zinc-900 ${
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
                        <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white" />
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: info */}
        <div className="md:w-1/2 flex flex-col gap-5 min-h-0">
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

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">Ubicación</span>
            <p className="text-lg text-white">{locationLine}</p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">Compartido por</span>
            <p className="text-lg text-amber-300 font-semibold">{username}</p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">Fecha</span>
            <p className="text-base text-white">
              {new Date(pin.created_at).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>

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

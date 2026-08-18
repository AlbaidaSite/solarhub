"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDialog, FocusScope } from "react-aria";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";
import type { PinDetail } from "@/types/map";
import { checkPinEditPermissionAction, deletePinAction } from "../actions";

interface PinModalProps {
  detail: PinDetail;
  onClose: () => void;
  onDelete?: () => void;
}

type DeleteStep = null | "confirm1" | "confirm2";

// Mismo armazón que EventDetailModal.tsx: una sola columna centrada
// (max-w-2xl) sobre el telón a pantalla completa, envuelta en un
// FocusScope que atrapa el foco — sin él, tabular desde el modal alcanza
// los controles del mapa que hay debajo (ver GlobeClient.tsx, que además
// desactiva el zoom mientras esto está abierto).
export default function PinModal({ detail, onClose, onDelete }: PinModalProps) {
  const router = useRouter();
  const { pin, countryName, username, sticker, media } = detail;
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);

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
  const locationLine = [pin.state, countryName].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/place/${pin.latitude},${pin.longitude}`;
  const dateLabel = new Date(pin.created_at).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Editar / eliminar — solo dueño del pin o staff. Anclados a la esquina
  // superior derecha del MEDIA (no del modal), con círculo negro detrás de
  // cada icono para distinguirse de cualquier fondo.
  const editDeleteButtons = canEdit ? (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => router.push(`/mapa/editar/${pin.id}`)}
        aria-label="Editar pegatina"
        title="Editar"
        className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/80 hover:text-amber-300 transition-colors cursor-pointer"
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null);
          setDeleteStep("confirm1");
        }}
        aria-label="Eliminar pegatina"
        title="Eliminar"
        className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/80 hover:text-red-400 transition-colors cursor-pointer"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={onClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-detail-title"
          className="min-h-full w-full max-w-2xl mx-auto flex flex-col gap-5 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cierre — mismo tratamiento que EventDetailModal.tsx */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar"
            className="fixed top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={35} />
          </button>

          {/* Confirmación de borrado en dos pasos */}
          {deleteStep !== null && (
            <div
              className="fixed inset-0 z-20 flex items-center justify-center bg-black/60"
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
                {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
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

          {/* Media a tamaño intrínseco (limitado por ancho Y alto, lo que
              llegue antes) en vez de forzar un cuadrado: una foto vertical
              ya no queda con franjas a los lados. La tesela de respaldo con
              el icono de la pegatina solo aparece en pines antiguos — desde
              que el multimedia es obligatorio (ver MediaSection.tsx) no se
              puede crear ninguno sin archivos. */}
          <div className="w-full flex justify-center shrink-0">
            {activeMedia ? (
              <div className="relative inline-block max-w-full">
                {activeMedia.type === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tamaño intrínseco: next/image "fill" exige un contenedor con tamaño ya fijado, justo lo contrario de lo que hace falta aquí.
                  <img
                    key={activeMedia.id}
                    src={activeMedia.url}
                    alt={pin.place}
                    className="max-w-full max-h-[42rem] w-auto h-auto rounded-xl border border-white/10 object-contain bg-zinc-900"
                  />
                ) : (
                  <video
                    key={activeMedia.id}
                    src={activeMedia.url}
                    controls
                    className="max-w-full max-h-[42rem] w-auto h-auto rounded-xl border border-white/10 object-contain bg-black"
                  />
                )}
                {editDeleteButtons}
              </div>
            ) : (
              <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center gap-3">
                {sticker ? (
                  <div className="relative h-16 w-16 shrink-0">
                    <Image
                      src={sticker.icon_path}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <span className="text-white/50 text-sm">Sin contenido multimedia</span>
                )}
                {editDeleteButtons}
              </div>
            )}
          </div>

          {/* Carrusel de miniaturas: solo con más de un archivo — mismo
              tratamiento visual que el de EventDetailModal.tsx. */}
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
                    <Image src={m.url} alt="" fill sizes="80px" className="object-cover" unoptimized />
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

          <h1 {...titleProps} id="pin-detail-title" className="text-4xl font-bold text-white">
            {pin.place}
          </h1>

          {/* Fecha destacada + aclaración debajo en pequeño, igual que
              la fecha y el "Hasta:" de EventDetailModal.tsx. Sin la
              segunda línea, una fecha suelta bajo el lugar no dice si es
              la de colocación o la de publicación. */}
          <div className="flex flex-col gap-1 text-white">
            <p className="text-2xl font-semibold">{dateLabel}</p>
            <p className="text-sm text-white/60">Fecha en la que se colocó</p>
          </div>

          {locationLine && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-white/50">Ubicación</span>
              <p className="text-base text-white">{locationLine}</p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-white/50">Compartido por</span>
            <p className="text-base text-amber-300 font-semibold">{username}</p>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start px-6 py-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 text-blue-300 text-base font-semibold transition-colors"
          >
            <ExternalLink size={20} />
            Ver en Google Maps
          </a>

          {/* Distintivo de pegatina: última fila, igual que la pastilla de
              tipo de evento en EventDetailModal.tsx. */}
          {sticker && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-sm font-medium text-white">
                <span className="relative h-4 w-4 shrink-0">
                  <Image
                    src={sticker.icon_path}
                    alt=""
                    fill
                    sizes="16px"
                    className="object-contain"
                    unoptimized
                  />
                </span>
                {sticker.name}
              </span>
            </div>
          )}
        </div>
      </FocusScope>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Repeat, X } from "lucide-react";
import CornerButton from "@/components/ui/CornerButton";
import { getStorageUrl } from "@/lib/supabase/storage";
import TradeCromoPanel from "./TradeCromoPanel";
import type { CromoDetail } from "@/types/cromo";

const LOCKED_URL = getStorageUrl("cromos/locked.webp");

interface CromoModalProps {
  cromo: CromoDetail;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function CromoModal({
  cromo,
  onClose,
  onPrev,
  onNext,
}: CromoModalProps) {
  const [showBack, setShowBack]           = useState(false);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [selectedUniqueIds, setSelectedUniqueIds] = useState<number[]>([]);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const displayFront = cromo.isImageLocked ? LOCKED_URL : cromo.front_img;
  const displayThumb = cromo.isImageLocked ? LOCKED_URL : cromo.front_thumb;

  // owned → full color + full info + can flip (even if previously owned)
  // formerly_owned → grayscale + full info + can flip
  // never_owned → grayscale + limited info (no description, no back)
  // isImageLocked → show locked.webp without grayscale (nobody has owned it yet)
  const isGrayscale  = cromo.ownershipState === "never_owned" && !cromo.isImageLocked;
  const canFlip      = cromo.ownershipState !== "never_owned";
  const showFullInfo = cromo.ownershipState !== "never_owned";

  const toggleUniqueSelected = (uniqueId: number) => {
    const target = cromo.userOwnedUniques.find((u) => u.uniqueId === uniqueId);
    if (target?.inTrade) return;
    setTradeError(null);
    setSelectedUniqueIds((prev) =>
      prev.includes(uniqueId)
        ? prev.filter((id) => id !== uniqueId)
        : [...prev, uniqueId],
    );
  };

  const handleOpenTradePanel = () => {
    if (selectedUniqueIds.length === 0) {
      setTradeError(
        "Es necesario escoger la copia a intercambiar en el apartado Copias.",
      );
      return;
    }
    setTradeError(null);
    setShowTradePanel(true);
  };

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  const handleImageClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (!canFlip) return;
    setShowBack((s) => !s);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      if (dx > 0 && onPrev) onPrev();
      else if (dx < 0 && onNext) onNext();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-40 bg-black/87 backdrop-blur-md scrollbar-clean ${
        showTradePanel
          ? "overflow-hidden"
          : "overflow-y-auto md:overflow-hidden"
      }`}
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
        {/* Izquierda: imagen + flechas de navegación */}
        <div className="md:w-1/2 flex items-center justify-center shrink-0 min-h-0">
          <div className="relative">
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Cromo anterior"
                className="absolute z-20 p-2 rounded-full text-white/80 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer
                  bottom-full mb-3 left-4
                  nav:bottom-auto nav:mb-0 nav:top-1/2 nav:-translate-y-1/2 nav:-left-12"
              >
                <ChevronLeft size={32} />
              </button>
            )}

            <button
              type="button"
              onClick={handleImageClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              aria-label={showBack ? "Mostrar frente" : "Mostrar reverso"}
              className="group relative aspect-1642/2223 w-auto h-[min(60vh,calc(28rem*2223/1642))] md:h-[min(calc(100vh-10rem),calc(28rem*2223/1642))] max-h-125 cursor-pointer bg-transparent border-0 p-0 perspective-distant"
            >
              {canFlip && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-4.5 left-1/2 -translate-x-1/2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <Repeat size={18} strokeWidth={1.5} />
                </span>
              )}

              <div
                className={`relative w-full h-full transform-3d transition-transform duration-700 ease-out ${
                  showBack ? "rotate-y-180" : ""
                }`}
              >
                {/* Cara frontal */}
                <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden bg-zinc-900">
                  <Image
                    src={displayThumb}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 80vw, 40vw"
                    className={`object-contain${isGrayscale ? " grayscale" : ""}`}
                    priority
                    aria-hidden
                  />
                  <Image
                    src={displayFront}
                    alt={cromo.name}
                    fill
                    sizes="(max-width: 768px) 80vw, 40vw"
                    className={`object-contain${isGrayscale ? " grayscale" : ""}`}
                    priority
                  />
                </div>
                {/* Cara reversa: solo si puede girar */}
                {canFlip && (
                  <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-zinc-900">
                    <Image
                      src={cromo.back_img}
                      alt={`${cromo.name} (reverso)`}
                      fill
                      sizes="(max-width: 768px) 80vw, 40vw"
                      className="object-contain"
                    />
                  </div>
                )}
              </div>
            </button>

            {onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label="Cromo siguiente"
                className="absolute z-20 p-2 rounded-full text-white/80 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer
                  bottom-full mb-3 right-4
                  nav:bottom-auto nav:mb-0 nav:top-1/2 nav:-translate-y-1/2 nav:-right-12"
              >
                <ChevronRight size={32} />
              </button>
            )}
          </div>
        </div>

        {/* Derecha: información */}
        <div className="md:w-1/2 md:overflow-y-auto md:pr-2 scrollbar-clean flex flex-col gap-6">
          {/* Bloque 1 */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-4">
              <h1 className="text-3xl font-bold text-white">
                {cromo.isImageLocked ? "Bloqueado" : cromo.name}
              </h1>

              {/* Descripción: solo si showFullInfo */}
              {showFullInfo && cromo.description && (
                <p className="text-zinc-200 leading-relaxed">{cromo.description}</p>
              )}

              {/* Artistas: solo si showFullInfo */}
              {showFullInfo && cromo.artists.length > 0 && (
                <p className="text-white">
                  <span className="font-bold underline mr-2">
                    {cromo.artists.length === 1 ? "Artist :" : "Artists :"}
                  </span>
                  {cromo.artists.map((a, i) => (
                    <span key={`${a.name}-${i}`}>
                      {i > 0 && ", "}
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 underline"
                        >
                          {a.name}
                        </a>
                      ) : (
                        a.name
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>

            {/* Categoría, número y rareza: siempre visibles */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              {cromo.category && (
                <Image
                  src={cromo.category.icon_path}
                  alt={cromo.category.name}
                  width={70}
                  height={70}
                  className="object-contain"
                />
              )}
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white">#{cromo.number}</span>
                {cromo.rarity && (
                  <Image
                    src={cromo.rarity.icon_path}
                    alt={cromo.rarity.name}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                )}
              </div>
            </div>
          </div>

          <hr className="border-zinc-700" />

          {/* Bloque 2 */}
          <div className="flex flex-col gap-4">
            {/* how_to_extended: siempre visible */}
            {cromo.how_to_extended && (
              <p className="text-white">
                <span className="font-bold underline mr-2">Cómo obtener :</span>
                {cromo.how_to_extended}
              </p>
            )}

            {/* Campos de posesión / intercambio: owned y formerly_owned */}
            {showFullInfo && (
              <>
                {cromo.firstAcquiredAt && (
                  <p className="text-white">
                    <span className="font-bold underline mr-2">Conseguido el :</span>
                    <span className="text-zinc-300">
                      {new Date(cromo.firstAcquiredAt).toLocaleDateString("es-ES")}
                    </span>
                  </p>
                )}

                {cromo.userOwnedUniques.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-white">
                      <span className="font-bold underline mr-2">Copias :</span>
                      <span className="text-zinc-300">{cromo.userOwnedUniques.length} / {cromo.copies}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cromo.userOwnedUniques.map((u) => {
                        const sel = selectedUniqueIds.includes(u.uniqueId);
                        const disabled = u.inTrade;
                        return (
                          <button
                            key={u.uniqueId}
                            type="button"
                            onClick={() => toggleUniqueSelected(u.uniqueId)}
                            disabled={disabled}
                            title={disabled ? "Esta copia ya está en un intercambio" : undefined}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              disabled
                                ? "bg-white/5 border-white/10 text-white/30 line-through cursor-not-allowed"
                                : sel
                                  ? "bg-amber-300/20 border-amber-300/60 text-amber-200 cursor-pointer"
                                  : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10 cursor-pointer"
                            }`}
                          >
                            #{u.copyNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-white">
                    <span className="font-bold underline mr-2">Copias :</span>
                    <span className="text-zinc-300">— / {cromo.copies}</span>
                  </p>
                )}

                {tradeError && (
                  <p className="text-red-400 text-sm">{tradeError}</p>
                )}

                {cromo.userOwnedUniques.length > 0 && (
                  <div className="self-end mt-4">
                    <CornerButton
                      type="button"
                      onClick={handleOpenTradePanel}
                    >
                      Intercambiar
                    </CornerButton>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Portal a document.body: el modal de cromo lleva backdrop-filter, lo
          que crea un containing block para hijos position:fixed. Si el panel
          se renderiza dentro, "fixed" se ancla al modal scrolleado (no al
          viewport) y aparece en la parte de arriba del modal en vez de donde
          mira el usuario. Sacándolo del árbol DOM esto se resuelve. */}
      {showTradePanel &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm p-8 overflow-y-auto overscroll-contain scrollbar-clean"
            onClick={(e) => e.stopPropagation()}
          >
            <TradeCromoPanel
              cromoName={cromo.name}
              selectedUniqueIds={selectedUniqueIds}
              onClose={() => {
                setShowTradePanel(false);
                setSelectedUniqueIds([]);
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

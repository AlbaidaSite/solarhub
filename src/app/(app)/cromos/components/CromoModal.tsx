"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Repeat, X } from "lucide-react";
import CornerButton from "@/components/ui/CornerButton";
import type { CromoDetail } from "@/types/cromo";

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
  const [showBack, setShowBack] = useState(false);

  // Tracking de touch para distinguir swipe horizontal de tap (flip)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  // Escape cierra, flechas navegan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // Bloquea el scroll del álbum mientras el modal esté abierto para que
  // el fondo semitransparente muestre exactamente la posición actual del
  // usuario. No se modifica scrollTop: el álbum queda congelado donde está.
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
    if (cromo.isLocked) return; // los bloqueados no giran
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

    // Solo swipes horizontales (>50 px y más horizontales que verticales)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      if (dx > 0 && onPrev) onPrev();
      else if (dx < 0 && onNext) onNext();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto md:overflow-hidden scrollbar-clean"
      onClick={onClose}
    >
      <button
        type="button"
        // stopPropagation evita que el click burbujee al backdrop (outer div),
        // cuyo onClick también es onClose: si no se para, se ejecutaría dos
        // veces seguidas (dos `router.back()` ⇒ retrocedes dos pasos).
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
            {/* Flecha anterior: en mobile encima del cromo (esquina sup. izq.); en desktop al lateral izquierdo */}
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

            {/* Botón imagen con flip 3D */}
            <button
              type="button"
              onClick={handleImageClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              aria-label={showBack ? "Mostrar frente" : "Mostrar reverso"}
              className="group relative aspect-1642/2223 w-auto h-[min(60vh,calc(28rem*2223/1642))] md:h-[min(calc(100vh-10rem),calc(28rem*2223/1642))] cursor-pointer bg-transparent border-0 p-0 perspective-distant"
            >
              {/* Icono Repeat al hacer hover (oculto en cromos bloqueados ya que no giran) */}
              {!cromo.isLocked && (
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
                {/* Cara frontal: thumb apilada debajo del full para precarga progresiva */}
                <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden bg-zinc-900">
                  <Image
                    src={cromo.front_thumb}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 80vw, 40vw"
                    className="object-contain"
                    priority
                    aria-hidden
                  />
                  <Image
                    src={cromo.front_img}
                    alt={cromo.name}
                    fill
                    sizes="(max-width: 768px) 80vw, 40vw"
                    className="object-contain"
                    priority
                  />
                </div>
                {/* Cara reversa: solo se monta si el cromo no está bloqueado, así
                    el back_img real ni siquiera se solicita al servidor */}
                {!cromo.isLocked && (
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

            {/* Flecha siguiente: en mobile encima del cromo (esquina sup. der.); en desktop al lateral derecho */}
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

        {/* Derecha: en desktop tiene su propio scroll independiente; en mobile fluye dentro del scroll del modal */}
        <div className="md:w-1/2 md:overflow-y-auto md:pr-2 scrollbar-clean flex flex-col gap-6">
          {/* Bloque 1 */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-4">
              {/* Nombre: "Bloqueado" si locked, real si desbloqueado */}
              <h1 className="text-3xl font-bold text-white">
                {cromo.isLocked ? "Bloqueado" : cromo.name}
              </h1>

              {/* Descripción: texto fijo si locked, real si desbloqueado */}
              {cromo.isLocked ? (
                <p className="text-zinc-400 italic">
                  Este cromo aún no ha sido desbloqueado.
                </p>
              ) : cromo.description ? (
                <p className="text-zinc-200 leading-relaxed">{cromo.description}</p>
              ) : null}

              {/* Artistas: solo cuando está desbloqueado */}
              {!cromo.isLocked && cromo.artists.length > 0 && (
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

            {/* Campos de posesión / intercambio: solo desbloqueado */}
            {!cromo.isLocked && (
              <>
                <p className="text-white">
                  <span className="font-bold underline mr-2">Conseguido el :</span>
                  <span className="text-zinc-300">DD/MM/YYYY</span>
                </p>

                <p className="text-white">
                  <span className="font-bold underline mr-2">Copias :</span>
                  <span className="text-zinc-300">— / {cromo.copies}</span>
                </p>

                <div className="self-end mt-4">
                  <CornerButton type="button">Intercambiar</CornerButton>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

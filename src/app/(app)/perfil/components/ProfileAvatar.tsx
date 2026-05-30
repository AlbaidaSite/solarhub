"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Eye, Pencil, X } from "lucide-react";

interface ProfileAvatarProps {
  avatarUrl: string;
  username: string;
}

export default function ProfileAvatar({ avatarUrl, username }: ProfileAvatarProps) {
  // Al pulsar la foto se revelan los dos botones (ojo = ampliar, lápiz = editar).
  const [showActions, setShowActions] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Esc cierra el visor ampliado.
  useEffect(() => {
    if (!showFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFull]);

  const openFull = () => {
    setShowFull(true);
    setShowActions(false);
  };

  // Posición final de cada botón respecto al centro del avatar (diagonal 45º).
  // Ocultos: centrados detrás del avatar (escala 0). Visibles: desplazados a
  // su esquina. La transición da el efecto de "salir desde detrás".
  const OUT = 52; // px de desplazamiento diagonal
  // El <button>/<Link> es un área de pulsación transparente de 52px (w-13) para
  // no tener que acertar sobre el icono; dentro va el círculo negro de 20px.
  const baseBtn =
    "group absolute top-1/2 left-1/2 inline-flex items-center justify-center w-13 h-13 rounded-full cursor-pointer transition-[transform,opacity] duration-300 ease-in-out";
  // Círculo negro de 20px que rodea el icono (hereda el click del botón padre).
  // El color del icono cambia al hacer hover sobre el círculo (group-hover).
  const iconCircle =
    "flex items-center justify-center w-6 h-6 rounded-full bg-black shadow-lg text-cyan-600 group-hover:text-white transition-colors duration-200";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowActions((v) => !v)}
        aria-label="Opciones de foto de perfil"
        aria-expanded={showActions}
        className="relative z-10 w-32 h-32 rounded-full overflow-hidden border border-zinc-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [clip-path:circle(50%)]"
      >
        <Image
          src={avatarUrl}
          alt={username}
          fill
          sizes="128px"
          className="object-cover"
          priority
        />
      </button>

      {/* Arriba a la izquierda: ampliar la imagen */}
      <button
        type="button"
        onClick={openFull}
        aria-label="Ampliar imagen"
        title="Ampliar imagen"
        tabIndex={showActions ? 0 : -1}
        aria-hidden={!showActions}
        style={{
          transform: showActions
            ? `translate(calc(-65% - ${OUT}px), calc(-65% - ${OUT}px)) scale(1)`
            : "translate(-65%, -65%) scale(1)",
          opacity: showActions ? 1 : 0,
          pointerEvents: showActions ? "auto" : "none",
        }}
        className={baseBtn}
      >
        <span className={iconCircle}>
          <Eye size={18} strokeWidth={2.5} />
        </span>
      </button>

      {/* Arriba a la derecha: editar la imagen */}
      <Link
        href="/perfil/avatar"
        aria-label="Editar foto de perfil"
        title="Editar foto de perfil"
        tabIndex={showActions ? 0 : -1}
        aria-hidden={!showActions}
        style={{
          transform: showActions
            ? `translate(calc(-35% + ${OUT}px), calc(-65% - ${OUT}px)) scale(1)`
            : "translate(-35%, -65%) scale(1)",
          opacity: showActions ? 1 : 0,
          pointerEvents: showActions ? "auto" : "none",
        }}
        className={baseBtn}
      >
        <span className={iconCircle}>
          <Pencil size={17} strokeWidth={2.5} />
        </span>
      </Link>

      {/* Visor ampliado: mismo estilo que el modal de cromos (fondo negro translúcido). */}
      {showFull &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/87 backdrop-blur-md p-6"
            onClick={() => setShowFull(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFull(false);
              }}
              aria-label="Cerrar"
              className="absolute top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={35} />
            </button>

            <div
              className="relative w-[min(80vw,80vh)] aspect-square rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={avatarUrl}
                alt={username}
                fill
                sizes="(max-width: 768px) 80vw, 80vh"
                className="object-contain"
                priority
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

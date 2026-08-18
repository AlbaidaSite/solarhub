"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useDialog, FocusScope } from "react-aria";
import { Sprout, X } from "lucide-react";
import { plantColorClasses } from "@/lib/plantColorClasses";
import PlantInfoSection from "./PlantInfoSection";
import CropDiary from "./CropDiary";
import type { Plant } from "@/types/garden";

interface PlantModalProps {
  plant: Plant;
  // Garden manager o staff: lo único que decide si se puede editar la
  // información de siembra/recolecta y el diario. Sin permiso la ficha se
  // ve entera igual, solo que de lectura.
  canManage: boolean;
  onClose: () => void;
  // Devuelve la planta ya actualizada por el servidor, para que quien la
  // tenga en su estado (el lienzo, el panel de cultivos) la sustituya sin
  // recargar el huerto entero.
  onPlantChange: (plant: Plant) => void;
  // Solo llega en móvil y con permiso de edición: en escritorio este cultivo
  // se planta arrastrando su icono del panel hasta el bancal, y ahí el botón
  // sobraría. Cierra la ficha y deja la vista esperando a que se toque un
  // bancal (ver HuertoView).
  onPlantHere?: () => void;
}

// Ficha de un cultivo: se abre desde el icono del panel de cultivos y
// desde una fila del listado de un bancal. Mismo armazón que el resto de
// modales de la app (fondo oscuro clicable, cierre fijo arriba a la
// izquierda, FocusScope).
export default function PlantModal({
  plant,
  canManage,
  onClose,
  onPlantChange,
  onPlantHere,
}: PlantModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Puede haber otro modal debajo (el del bancal) que ya lo dejó en
  // "hidden": se guarda y se restaura el valor anterior, no se limpia a
  // secas, para no devolverle el scroll al fondo al cerrar solo la ficha.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  const colors = plantColorClasses(plant.color);

  return (
    // z-50 (el resto de modales van en z-40): la ficha puede abrirse
    // ENCIMA del modal de bancal, desde su listado de cultivos.
    <div
      className="fixed inset-0 z-50 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={onClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plant-detail-title"
          className="min-h-full w-full max-w-lg mx-auto flex flex-col gap-6 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
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

          <header className="flex items-center gap-4">
            <div
              className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 ${colors.border}`}
            >
              <Image
                src={plant.icon_path}
                alt=""
                fill
                sizes="96px"
                className="object-contain p-2"
                unoptimized
              />
            </div>
            {/* El id va DESPUES del spread: titleProps trae el suyo propio
                y, puesto antes, lo pisaba — el aria-labelledby de arriba
                apuntaba entonces a un elemento que no existia y la ficha se
                quedaba sin nombre accesible. */}
            <h1 {...titleProps} id="plant-detail-title" className="text-4xl font-bold text-white">
              {plant.name}
            </h1>
          </header>

          {/* Encima de la información de la ficha a propósito: quien abre
              un cultivo con intención de plantarlo no debería tener que
              recorrer siembra, recolecta y diario para encontrar el botón. */}
          {onPlantHere && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlantHere();
              }}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 font-semibold text-white transition-colors hover:bg-cyan-400/20 cursor-pointer"
            >
              <Sprout size={20} />
              Plantar en un bancal
            </button>
          )}

          <PlantInfoSection
            section="siembra"
            plant={plant}
            canManage={canManage}
            onPlantChange={onPlantChange}
          />
          <PlantInfoSection
            section="recolecta"
            plant={plant}
            canManage={canManage}
            onPlantChange={onPlantChange}
          />

          {/* El diario va separado del resto por una línea: es la única
              parte de la ficha con vida propia (entradas por año, con su
              propia navegación). */}
          <hr className="border-white/15" />

          <CropDiary plantId={plant.id} canManage={canManage} />
        </div>
      </FocusScope>
    </div>
  );
}

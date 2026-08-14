"use client";

import Image from "next/image";
import type { Plant } from "@/types/garden";

interface PlantRowProps {
  plant: Plant;
  onSelect?: (plantId: number) => void;
  // Presente solo cuando el icono se puede arrastrar hasta un bancal
  // (escritorio y con permiso de edición). Con arrastre activo el clic
  // NO se resuelve aquí: quien arrastra distingue clic de arrastre por el
  // recorrido del puntero y llama a onSelect él mismo (ver HuertoView).
  onDragStart?: (plant: Plant, event: React.PointerEvent) => void;
}

export default function PlantRow({ plant, onSelect, onDragStart }: PlantRowProps) {
  const draggable = onDragStart != null;

  return (
    <button
      type="button"
      onPointerDown={draggable ? (e) => onDragStart(plant, e) : undefined}
      onClick={draggable ? undefined : () => onSelect?.(plant.id)}
      title={plant.name}
      aria-label={plant.name}
      className={`relative w-14 h-14 shrink-0 ${
        draggable ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <Image
        src={plant.icon_path}
        alt={plant.name}
        fill
        sizes="56px"
        className="object-contain"
        // Sin esto el navegador inicia su propio arrastre nativo de
        // imagen al mantener pulsado, que se come los eventos de puntero.
        draggable={false}
      />
    </button>
  );
}

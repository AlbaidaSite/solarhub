"use client";

import Image from "next/image";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { plantColorClasses } from "@/lib/plantColorClasses";
import type { Plant, PlantBed } from "@/types/garden";

interface CropListRowProps {
  row: PlantBed;
  plant: Plant | undefined;
  // El botón de mover solo existe si hay algo entre lo que reordenar.
  canReorder: boolean;
  isDragging: boolean;
  onReorderStart: (rowId: number, event: React.PointerEvent) => void;
  onEdit: (row: PlantBed) => void;
  onDelete: (rowId: number) => void;
  // Abre la ficha del cultivo. Ausente (o fila sin planta identificada):
  // el icono y el nombre no son clicables.
  onPlantSelect?: (plantId: number) => void;
  // Garden manager o staff: sin permiso la fila se ve igual pero sin
  // ninguno de sus tres botones.
  canManage: boolean;
}

// Fila del listado de cultivos de un bancal: icono a la izquierda,
// nombre + tipo en medio y los tres botones a la derecha. Mismo lenguaje
// visual que EventListRow (borde tenue, esquinas xl, iconos de 8x8).
export default function CropListRow({
  row,
  plant,
  canReorder,
  isDragging,
  onReorderStart,
  onEdit,
  onDelete,
  onPlantSelect,
  canManage,
}: CropListRowProps) {
  const colors = plantColorClasses(plant?.color ?? null);

  // Icono + nombre: el bloque es el mismo se pueda abrir la ficha o no,
  // solo cambia si lo envuelve un <button> o un <div>.
  const identity = (
    <>
      <div
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 ${colors.border}`}
      >
        {plant ? (
          <Image
            src={plant.icon_path}
            alt=""
            fill
            sizes="48px"
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <span aria-hidden className="text-white/40 text-xl">
            ?
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0 text-left">
        <span className="font-medium truncate">{plant?.name ?? "Cultivo sin identificar"}</span>
        {row.description && (
          <span className="text-sm text-white/50 truncate">{row.description}</span>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-zinc-900 p-2 transition-colors ${
        isDragging ? "border-white/40 shadow-lg" : "border-white/10"
      }`}
    >
      {plant && onPlantSelect ? (
        <button
          type="button"
          onClick={() => onPlantSelect(plant.id)}
          title={`Ver la ficha de ${plant.name}`}
          className="flex flex-1 items-center gap-3 min-w-0 text-white transition-colors hover:text-amber-300 cursor-pointer"
        >
          {identity}
        </button>
      ) : (
        <div className="flex flex-1 items-center gap-3 min-w-0 text-white">{identity}</div>
      )}

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          {canReorder && (
            <button
              type="button"
              // Sin onClick: el gesto es mantener pulsado y arrastrar. Se
              // captura en pointerdown para que valga igual con ratón y con
              // dedo (touch-none evita que el móvil lo lea como scroll).
              onPointerDown={(e) => onReorderStart(row.id, e)}
              aria-label="Mover cultivo"
              title="Mover (mantén pulsado y arrastra)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(row)}
            aria-label="Editar cultivo"
            title="Editar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            aria-label="Eliminar cultivo"
            title="Eliminar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

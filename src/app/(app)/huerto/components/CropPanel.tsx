"use client";

import Triangle from "./Triangle";
import MonthSelect from "./MonthSelect";
import PlantGroupList from "./PlantGroupList";
import { nextMonth, previousMonth } from "../lib/monthNames";
import { monthGroups } from "../lib/monthGroups";
import type { Plant } from "@/types/garden";

// Mismo lenguaje visual que el paginador de cromos y el calendario de
// eventos: sin chip de fondo, solo el triángulo cambiando a ámbar en hover.
const NAV_ARROW_CLASS = "text-white transition-colors hover:text-amber-300 cursor-pointer";

interface CropPanelProps {
  plants: Plant[];
  month: number;
  onMonthChange: (month: number) => void;
  onPlantSelect?: (plantId: number) => void;
  // Solo llega en escritorio y con permiso de edición: es lo que habilita
  // arrastrar un icono hasta un bancal.
  onPlantDragStart?: (plant: Plant, event: React.PointerEvent) => void;
}

export default function CropPanel({
  plants,
  month,
  onMonthChange,
  onPlantSelect,
  onPlantDragStart,
}: CropPanelProps) {
  if (plants.length === 0) {
    return <p className="text-white/40">No hay plantas registradas en el sistema.</p>;
  }

  const groups = monthGroups(plants, month);

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-6">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onMonthChange(previousMonth(month))}
          className={NAV_ARROW_CLASS}
        >
          <Triangle direction="left" />
        </button>
        <h2 className="text-2xl font-bold">Cultivos de</h2>
        <MonthSelect month={month} onChange={onMonthChange} />
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onMonthChange(nextMonth(month))}
          className={NAV_ARROW_CLASS}
        >
          <Triangle direction="right" />
        </button>
      </div>

      <div className="space-y-6">
        <PlantGroupList
          title="Siembra"
          plants={groups.siembra}
          onPlantSelect={onPlantSelect}
          onPlantDragStart={onPlantDragStart}
        />
        <PlantGroupList
          title="Recogida"
          plants={groups.recogida}
          onPlantSelect={onPlantSelect}
          onPlantDragStart={onPlantDragStart}
        />
        <PlantGroupList
          title="Otros"
          plants={groups.otros}
          onPlantSelect={onPlantSelect}
          onPlantDragStart={onPlantDragStart}
        />
      </div>
    </div>
  );
}

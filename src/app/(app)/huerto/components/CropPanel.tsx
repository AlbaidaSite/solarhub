"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import MonthSelect from "./MonthSelect";
import PlantGroupList from "./PlantGroupList";
import { nextMonth, previousMonth } from "../lib/monthNames";
import { monthGroups } from "../lib/monthGroups";
import type { Plant } from "@/types/garden";

interface CropPanelProps {
  plants: Plant[];
  month: number;
  onMonthChange: (month: number) => void;
  onPlantSelect?: (plantId: number) => void;
}

export default function CropPanel({ plants, month, onMonthChange, onPlantSelect }: CropPanelProps) {
  if (plants.length === 0) {
    return <p className="text-white/40">No hay plantas registradas en el sistema.</p>;
  }

  const groups = monthGroups(plants, month);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onMonthChange(previousMonth(month))}
        >
          <ChevronLeft />
        </button>
        <h2 className="text-2xl font-bold">Cultivos de</h2>
        <MonthSelect month={month} onChange={onMonthChange} />
        <button type="button" aria-label="Mes siguiente" onClick={() => onMonthChange(nextMonth(month))}>
          <ChevronRight />
        </button>
      </div>

      <div className="space-y-6">
        <PlantGroupList title="Siembra" plants={groups.siembra} onPlantSelect={onPlantSelect} />
        <PlantGroupList title="Recogida" plants={groups.recogida} onPlantSelect={onPlantSelect} />
        <PlantGroupList title="Otros" plants={groups.otros} onPlantSelect={onPlantSelect} />
      </div>
    </div>
  );
}

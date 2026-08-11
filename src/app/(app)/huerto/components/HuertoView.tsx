"use client";

import { useMemo, useState } from "react";
import ModeToggle from "./ModeToggle";
import GardenCanvas from "./GardenCanvas";
import CropPanel from "./CropPanel";
import HuertoTabs, { HUERTO_TAB_IDS, type HuertoTab } from "./HuertoTabs";
import { bedsForDistribution } from "../lib/bedsForDistribution";
import type { GardenBed, GardenMode, Plant, PlantBed } from "@/types/garden";

interface HuertoViewProps {
  plants: Plant[];
  beds: GardenBed[];
  plantBeds: PlantBed[];
  initialMonth: number;
}

export default function HuertoView({ plants, beds, plantBeds, initialMonth }: HuertoViewProps) {
  const [mode, setMode] = useState<GardenMode>("actual");
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<HuertoTab>("bancal");

  const plantsById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const distribution = useMemo(() => bedsForDistribution(plantBeds, mode), [plantBeds, mode]);

  const handlePlantSelect = (_plantId: number) => {
    // Modal de detalle de planta: trabajo posterior, ver seed_info /
    // harvest_info en el modelo. Handler expuesto sin implementar.
  };

  return (
    // Altura explícita en vez de heredar h-full: el padding superior
    // del navbar (pt-32 = 8rem, ver (app)/layout.tsx) vive en el <main>
    // compartido por toda la app, cuyo wrapper de {children} no tiene
    // min-h-0 -- así que un simple h-full no acota nada aquí (el
    // ancestro se estiraría con el contenido en vez de al revés). Con
    // el alto ya resuelto explícitamente, el resto de la cadena
    // (min-h-0 hacia abajo) sí reparte el hueco real correctamente.
    <div className="flex flex-col gap-4 h-[calc(100dvh-8rem)] min-h-0">
      <HuertoTabs tab={tab} onChange={setTab} />

      <div className="flex flex-col gap-4 flex-1 min-h-0 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
        <section
          id={HUERTO_TAB_IDS.bancalPanel}
          role="tabpanel"
          aria-labelledby={HUERTO_TAB_IDS.bancalTab}
          className={`${tab === "bancal" ? "flex" : "hidden"} md:flex flex-col gap-4 h-full min-h-0`}
        >
          <ModeToggle mode={mode} onChange={setMode} />
          {/* pb-6: margen respecto al borde inferior, para que el
              lienzo no quede pegado al fondo de la ventana. */}
          <div className="flex items-center justify-center flex-1 min-h-0 pb-6">
            <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode={mode} />
          </div>
        </section>

        <div aria-hidden className="hidden md:flex items-center justify-center px-2">
          <div className="h-full w-px bg-linear-to-b from-transparent via-zinc-700 to-transparent" />
        </div>

        <section
          id={HUERTO_TAB_IDS.cultivosPanel}
          role="tabpanel"
          aria-labelledby={HUERTO_TAB_IDS.cultivosTab}
          className={`${tab === "cultivos" ? "block" : "hidden"} md:block min-h-0 h-full overflow-y-auto`}
        >
          <CropPanel
            plants={plants}
            month={month}
            onMonthChange={setMonth}
            onPlantSelect={handlePlantSelect}
          />
        </section>
      </div>
    </div>
  );
}

"use client";

import { useId } from "react";
import BedShape from "./BedShape";
import { BED_STROKE_WIDTH, CANVAS_VIEWBOX, GARDEN_CANVAS } from "../lib/canvas";
import type { GardenBed, GardenMode, Plant, PlantBed } from "@/types/garden";

interface GardenCanvasProps {
  beds: GardenBed[];
  distribution: Map<number, PlantBed[]>;
  plantsById: Map<number, Plant>;
  mode: GardenMode;
}

// Orden estable de los cultivos dentro de un bancal: por nombre de
// planta, desempatando por el id de la fila de plant_bed. Sin esto, dos
// renders del mismo bancal pueden intercambiar los iconos de sitio.
function sortRows(rows: PlantBed[], plantsById: Map<number, Plant>): PlantBed[] {
  return [...rows].sort((a, b) => {
    const nameA = (a.plant_id != null ? plantsById.get(a.plant_id)?.name : undefined) ?? "";
    const nameB = (b.plant_id != null ? plantsById.get(b.plant_id)?.name : undefined) ?? "";
    const byName = nameA.localeCompare(nameB, "es-ES", { sensitivity: "base" });
    return byName !== 0 ? byName : a.id - b.id;
  });
}

export default function GardenCanvas({ beds, distribution, plantsById, mode }: GardenCanvasProps) {
  const titleId = useId();
  const modeLabel = mode === "actual" ? "actual" : "planificada";

  return (
    <div className="w-full h-full">
      <div className="w-full h-full flex items-center justify-center">
        <svg
          viewBox={CANVAS_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={titleId}
          // El contenedor (ver HuertoView) ya tiene un alto acotado por
          // el layout real -- navbar, ModeToggle, pestañas, márgenes --
          // así que basta con max-width/max-height al 100% de ese
          // hueco: el <svg> es un elemento reemplazado (como <img>) y
          // encoge/crece manteniendo su proporción real (viewBox) hasta
          // ese límite, sin necesidad de calcular nada a mano. min-height
          // impone el suelo de 400px, que gana si el hueco es menor.
          style={{ minHeight: 400 }}
          className="block max-w-full max-h-full text-white"
        >
          <title id={titleId}>{`Distribución ${modeLabel} del huerto`}</title>
          <rect
            x={0}
            y={0}
            width={GARDEN_CANVAS.width}
            height={GARDEN_CANVAS.height}
            rx={6}
            fill="none"
            stroke="currentColor"
            strokeWidth={BED_STROKE_WIDTH}
          />
          {beds.map((bed) => (
            <BedShape
              key={bed.id}
              bed={bed}
              rows={sortRows(distribution.get(bed.id) ?? [], plantsById)}
              plantsById={plantsById}
            />
          ))}
        </svg>
      </div>

      <ul className="sr-only">
        {beds.map((bed) => {
          const rows = distribution.get(bed.id) ?? [];
          if (rows.length === 0) {
            return <li key={bed.id}>{bed.name}: vacío</li>;
          }
          const crops = rows
            .map((pb) => {
              const plant = pb.plant_id != null ? plantsById.get(pb.plant_id) : undefined;
              const name = plant?.name ?? "cultivo sin identificar";
              return pb.description ? `${name} (${pb.description})` : name;
            })
            .join(", ");
          return (
            <li key={bed.id}>
              {bed.name}: {crops}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

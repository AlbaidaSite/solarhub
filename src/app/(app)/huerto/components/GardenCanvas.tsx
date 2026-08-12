"use client";

import { useId, type RefObject } from "react";
import BedShape, { type BedPreview } from "./BedShape";
import { BED_STROKE_WIDTH, CANVAS_VIEWBOX, GARDEN_CANVAS } from "../lib/canvas";
import type { GardenBed, GardenMode, Plant, PlantBed } from "@/types/garden";

export interface CanvasPreview extends BedPreview {
  bedId: number;
}

interface GardenCanvasProps {
  beds: GardenBed[];
  distribution: Map<number, PlantBed[]>;
  plantsById: Map<number, Plant>;
  mode: GardenMode;
  // Solo lo reciben quienes pueden editar el huerto (garden manager o
  // staff). Su ausencia es lo que hace el lienzo puramente informativo.
  onBedSelect?: (bedId: number) => void;
  // Cultivo arrastrándose sobre uno de los bancales, si lo hay.
  preview?: CanvasPreview | null;
  // Lo necesita quien traduzca coordenadas de puntero a unidades de
  // lienzo durante el arrastre (ver clientToCanvasPoint).
  svgRef?: RefObject<SVGSVGElement | null>;
}

export default function GardenCanvas({
  beds,
  distribution,
  plantsById,
  mode,
  onBedSelect,
  preview,
  svgRef,
}: GardenCanvasProps) {
  const titleId = useId();
  const modeLabel = mode === "actual" ? "actual" : "planificada";
  const interactive = onBedSelect != null;
  const canvasLabel = `Distribución ${modeLabel} del huerto`;

  return (
    <div className="w-full h-full">
      <div className="w-full h-full flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={CANVAS_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          // Con role="img" el lienzo es una imagen única y sus hijos no se
          // exponen: los bancales clicables quedarían fuera del alcance de
          // un lector de pantalla. Cuando se puede editar pasa a ser un
          // grupo, y cada bancal es un botón con su propia etiqueta (ver
          // BedShape); la lista sr-only de abajo cubre el caso de solo
          // lectura, donde no hay nada que enfocar.
          role={interactive ? "group" : "img"}
          aria-labelledby={interactive ? undefined : titleId}
          aria-label={interactive ? canvasLabel : undefined}
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
          <title id={titleId}>{canvasLabel}</title>
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
              // Ya vienen ordenados por order_number (bedsForDistribution).
              rows={distribution.get(bed.id) ?? []}
              plantsById={plantsById}
              preview={preview?.bedId === bed.id ? preview : null}
              onSelect={onBedSelect}
            />
          ))}
        </svg>
      </div>

      {!interactive && (
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
      )}
    </div>
  );
}

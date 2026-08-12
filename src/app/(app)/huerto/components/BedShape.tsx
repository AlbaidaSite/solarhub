"use client";

import { plantColorClasses } from "@/lib/plantColorClasses";
import { subcellsFor } from "../lib/subcells";
import { BED_STROKE_WIDTH } from "../lib/canvas";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

// Grosor del contorno de un cultivo, en píxeles de pantalla: con
// vectorEffect="non-scaling-stroke" el trazo no se reescala con el
// viewBox, así que estos 3 son 3px reales a cualquier tamaño del lienzo.
const CROP_STROKE_WIDTH = 4;

// Cultivo ya plantado: relleno del color de la planta al 60%, contorno a
// pleno color. La previsualización de arrastre baja ambas cosas para que
// se lea como "esto todavía no está", sin cambiar de color.
const CROP_FILL_OPACITY = 0.25;
const PREVIEW_FILL_OPACITY = 0.15;
const PREVIEW_STROKE_OPACITY = 0.85;
const PREVIEW_ICON_OPACITY = 0.65;

export interface BedPreview {
  plant: Plant;
  // Posición que ocuparía dentro del bancal (ver insertionIndexFor).
  index: number;
}

interface BedShapeProps {
  bed: GardenBed;
  // Ya ordenados por order_number (ver sortRows en GardenCanvas).
  rows: PlantBed[];
  plantsById: Map<number, Plant>;
  // Cultivo que se está arrastrando por encima de ESTE bancal. Se dibuja
  // una subcelda de más: los cultivos existentes se compactan solos, sin
  // estado intermedio, porque la división se recalcula con uno más.
  preview?: BedPreview | null;
  onSelect?: (bedId: number) => void;
}

interface CropEntry {
  key: string;
  plant: Plant | undefined;
  isPreview: boolean;
}

export default function BedShape({ bed, rows, plantsById, preview, onSelect }: BedShapeProps) {
  const entries = cropEntries(rows, plantsById, preview);
  const subcells = subcellsFor(bed, entries.length);
  const interactive = onSelect != null;
  const label = bedTooltip(bed, rows, plantsById);

  return (
    <g
      // El <g> es el objetivo de clic entero (contorno + cultivos): un
      // bancal vacío no tiene nada dibujado dentro, así que el relleno
      // transparente de abajo es lo único que puede recibir el puntero.
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      onClick={interactive ? () => onSelect(bed.id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(bed.id);
              }
            }
          : undefined
      }
      className={interactive ? "cursor-pointer focus:outline-none" : undefined}
    >
      <title>{label}</title>
      <rect
        x={bed.pos_x}
        y={bed.pos_y}
        width={bed.width}
        height={bed.height}
        rx={6}
        // Transparente, no "none": con fill="none" el interior del bancal
        // no captura el puntero y un bancal vacío sería inclicable.
        fill="transparent"
        stroke="currentColor"
        strokeWidth={BED_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
        className="text-white"
      />

      {entries.map((entry, i) => {
        const cell = subcells[i];
        const colors = plantColorClasses(entry.plant?.color ?? null);

        return (
          <g key={entry.key} className={colors.text}>
            <polygon
              points={cell.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="currentColor"
              fillOpacity={entry.isPreview ? PREVIEW_FILL_OPACITY : CROP_FILL_OPACITY}
              stroke="currentColor"
              strokeOpacity={entry.isPreview ? PREVIEW_STROKE_OPACITY : 1}
              strokeWidth={CROP_STROKE_WIDTH}
              vectorEffect="non-scaling-stroke"
            />
            {entry.plant && cell.icon.width > 0 && (
              // next/image no funciona dentro de <svg>: emite un
              // <img>/<picture> HTML, que no es contenido SVG válido.
              // Solo <image href> (o <foreignObject>) sirve aquí. Son
              // iconos diminutos, la optimización de next/image no
              // aporta nada en este contexto.
              //
              // La caja ya viene calculada cuadrada y sin tocar ningún
              // borde (ver subcells.ts); "meet" hace el resto: el icono
              // crece hasta donde puede y se centra, sin deformarse ni
              // estirarse a la forma de la celda.
              <image
                href={entry.plant.icon_path}
                x={cell.icon.x}
                y={cell.icon.y}
                width={cell.icon.width}
                height={cell.icon.height}
                opacity={entry.isPreview ? PREVIEW_ICON_OPACITY : undefined}
                preserveAspectRatio="xMidYMid meet"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// Inserta la previsualización en su posición, empujando al resto. La
// clave del fantasma no puede ser su índice: al moverlo de posición
// React reutilizaría el nodo equivocado y el icono parpadearía.
function cropEntries(
  rows: PlantBed[],
  plantsById: Map<number, Plant>,
  preview: BedPreview | null | undefined,
): CropEntry[] {
  const entries: CropEntry[] = rows.map((pb) => ({
    key: `pb-${pb.id}`,
    plant: pb.plant_id != null ? plantsById.get(pb.plant_id) : undefined,
    isPreview: false,
  }));

  if (preview) {
    const index = Math.min(Math.max(preview.index, 0), entries.length);
    entries.splice(index, 0, { key: "preview", plant: preview.plant, isPreview: true });
  }

  return entries;
}

function bedTooltip(bed: GardenBed, rows: PlantBed[], plantsById: Map<number, Plant>): string {
  if (rows.length === 0) return `${bed.name}: vacío`;
  const crops = rows
    .map((pb) => {
      const plant = pb.plant_id != null ? plantsById.get(pb.plant_id) : undefined;
      const name = plant?.name ?? "cultivo sin identificar";
      return pb.description ? `${name} (${pb.description})` : name;
    })
    .join(", ");
  return `${bed.name}: ${crops}`;
}

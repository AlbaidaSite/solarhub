"use client";

import { plantColorClasses } from "@/lib/plantColorClasses";
import { subcellsFor } from "../lib/subcells";
import { BED_STROKE_WIDTH } from "../lib/canvas";
import { bedSummary } from "../lib/bedCrops";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

// Grosor del contorno de un cultivo, en píxeles de PANTALLA: con
// vectorEffect="non-scaling-stroke" el trazo no se reescala con el
// viewBox, así que vale lo mismo a cualquier tamaño del lienzo.
const CROP_STROKE_WIDTH = 4;

// Cultivo ya plantado: contorno a pleno color y relleno del mismo color
// translúcido. La previsualización de arrastre baja ambas cosas para que
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
  // Las coordenadas del toque solo llegan desde el puntero; activando con
  // teclado no hay ninguna. Quien las recibe decide en qué posición del
  // bancal cae (ver insertionIndexFor), y sin ellas añade al final.
  onSelect?: (bedId: number, clientX?: number, clientY?: number) => void;
  // Puntero de ratón entrando o saliendo del bancal. Se pasa el rectángulo en
  // pantalla en vez de las coordenadas del cursor para que el recuadro quede
  // anclado al bancal y no tiemble al mover el ratón por dentro.
  onHoverChange?: (bed: GardenBed | null, rect?: DOMRect) => void;
}

interface CropEntry {
  key: string;
  plant: Plant | undefined;
  isPreview: boolean;
}

export default function BedShape({
  bed,
  rows,
  plantsById,
  preview,
  onSelect,
  onHoverChange,
}: BedShapeProps) {
  const entries = cropEntries(rows, plantsById, preview);
  const subcells = subcellsFor(bed, entries.length);
  const interactive = onSelect != null;
  const label = bedSummary(bed, rows, plantsById);

  // pointerenter/leave y no over/out: los primeros no se disparan al pasar de
  // un hijo a otro dentro del bancal, así que el recuadro no parpadea al
  // cruzar de una subcelda de cultivo a la siguiente.
  const handleEnter = onHoverChange
    ? (e: React.PointerEvent<SVGGElement>) => {
        // Solo ratón: en táctil no hay hover, y el toque abre el modal. Con un
        // botón pulsado se está arrastrando un cultivo hasta aquí, no
        // consultando lo que hay plantado.
        if (e.pointerType !== "mouse" || e.buttons !== 0) return;
        onHoverChange(bed, e.currentTarget.getBoundingClientRect());
      }
    : undefined;

  return (
    <g
      // El <g> es el objetivo de clic entero (contorno + cultivos): un
      // bancal vacío no tiene nada dibujado dentro, así que el relleno
      // transparente de abajo es lo único que puede recibir el puntero.
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      onClick={
        interactive
          ? (e) => {
              // Sin esto el clic sigue subiendo hasta el contenedor de la
              // vista, que en modo "plantar" lo lee como toque fuera de un
              // bancal y cancela justo lo que se acaba de hacer.
              e.stopPropagation();
              onSelect(bed.id, e.clientX, e.clientY);
            }
          : undefined
      }
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
      onPointerEnter={handleEnter}
      onPointerLeave={onHoverChange ? () => onHoverChange(null) : undefined}
      onPointerDown={(e) => {
        // Al abrir el modal o empezar a arrastrar, el recuadro sobra.
        onHoverChange?.(null);
        // Y no debe seguir subiendo: la vista lee un pointerdown fuera de un
        // bancal como "se ha arrepentido" y cancela el cultivo a la espera.
        e.stopPropagation();
      }}
      className={interactive ? "cursor-pointer focus:outline-none" : undefined}
    >
      {/* Sin <title>: el tooltip nativo que genera no se puede agrandar ni dar
          formato, y saldría además del recuadro propio (ver GardenCanvas). La
          etiqueta accesible la da aria-label cuando el bancal es clicable, y
          la lista sr-only del lienzo cuando no lo es. */}
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


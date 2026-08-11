import { subcellsFor } from "../lib/subcells";
import { BED_STROKE_WIDTH } from "../lib/canvas";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

// En unidades de lienzo (ver GARDEN_CANVAS): con bancales reales de
// 60-320 unidades de lado, un margen de 0.3 quedaría invisible.
const BED_MARGIN = 1.5;
const ICON_MARGIN = 3;

interface BedShapeProps {
  bed: GardenBed;
  rows: PlantBed[];
  plantsById: Map<number, Plant>;
}

export default function BedShape({ bed, rows, plantsById }: BedShapeProps) {
  const occupied = rows.length > 0;
  const subcells = subcellsFor(bed, rows.length);

  return (
    <g className={occupied ? "text-cyan-400" : undefined}>
      <title>{bedTooltip(bed, rows, plantsById)}</title>
      <rect
        x={bed.pos_x}
        y={bed.pos_y}
        width={bed.width}
        height={bed.height}
        rx={6}
        fill="none"
        stroke="currentColor"
        strokeWidth={BED_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {rows.map((pb, i) => {
        const cell = subcells[i];
        const plant = pb.plant_id != null ? plantsById.get(pb.plant_id) : undefined;
        const inset = Math.min(BED_MARGIN, cell.width / 4, cell.height / 4);
        const cellX = cell.x + inset;
        const cellY = cell.y + inset;
        const cellWidth = cell.width - inset * 2;
        const cellHeight = cell.height - inset * 2;
        const iconInset = Math.min(ICON_MARGIN, cellWidth / 4, cellHeight / 4);

        return (
          <g key={pb.id}>
            <rect
              x={cellX}
              y={cellY}
              width={cellWidth}
              height={cellHeight}
              rx={3}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {plant && (
              // next/image no funciona dentro de <svg>: emite un
              // <img>/<picture> HTML, que no es contenido SVG válido.
              // Solo <image href> (o <foreignObject>) sirve aquí. Son
              // iconos diminutos, la optimización de next/image no
              // aporta nada en este contexto.
              <image
                href={plant.icon_path}
                x={cellX + iconInset}
                y={cellY + iconInset}
                width={cellWidth - iconInset * 2}
                height={cellHeight - iconInset * 2}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
          </g>
        );
      })}
    </g>
  );
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

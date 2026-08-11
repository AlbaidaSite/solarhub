import { subcellsFor } from "../lib/subcells";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

const BED_MARGIN = 0.3;
const ICON_MARGIN = 0.6;

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
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
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
              fill="none"
              stroke="currentColor"
              strokeWidth={0.3}
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

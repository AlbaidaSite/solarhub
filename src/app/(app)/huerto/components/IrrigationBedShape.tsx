"use client";

import { irrigationInfo } from "../lib/irrigation";
import BedFrame from "./BedFrame";
import type { GardenBed, IrrigationLevel } from "@/types/garden";

// Lado del icono como fracción del lado MENOR del bancal. Los bancales
// reales son alargados (300x60, 100x300…), así que mandar sobre el lado
// menor es lo único que garantiza que el icono no se salga por el lado
// estrecho.
const ICON_SIZE_RATIO = 0.6;

// Tope en unidades de lienzo: sin él, un bancal grande y cuadrado se
// llevaría un icono desproporcionado respecto al resto del huerto.
const ICON_MAX_SIZE = 64;

interface IrrigationBedShapeProps {
  bed: GardenBed;
  level: IrrigationLevel | undefined;
  onSelect?: (bedId: number) => void;
  onHoverChange?: (bed: GardenBed | null, rect?: DOMRect) => void;
}

// Bancal en la lectura de riego: el mismo contorno y la misma posición
// que en la de cultivos (lo pone BedFrame), con un único icono centrado
// que dice cómo está el riego.
export default function IrrigationBedShape({
  bed,
  level,
  onSelect,
  onHoverChange,
}: IrrigationBedShapeProps) {
  const info = irrigationInfo(level);
  const { Icon } = info;

  const size = Math.min(Math.min(bed.width, bed.height) * ICON_SIZE_RATIO, ICON_MAX_SIZE);
  const x = bed.pos_x + (bed.width - size) / 2;
  const y = bed.pos_y + (bed.height - size) / 2;

  return (
    <BedFrame
      bed={bed}
      label={`${bed.name}: riego ${info.label.toLowerCase()}`}
      // BedFrame pasa además las coordenadas del puntero, que aquí no
      // significan nada: en riego el bancal entero es un solo objetivo,
      // no hay subceldas en las que caer.
      onSelect={onSelect ? (bedId) => onSelect(bedId) : undefined}
      onHoverChange={onHoverChange}
    >
      {/* Un icono de lucide es un <svg> con su propio viewBox de 24x24, y
          un <svg> anidado dentro de otro es SVG válido: con x/y/width/height
          se coloca y escala como cualquier otra forma. Hay que darle
          width/height y NO `size`, que es el atajo de lucide para poner los
          dos a la vez en píxeles y aquí las unidades son las del lienzo.

          El color va por clase (lucide dibuja con stroke="currentColor"), y
          el trazo SÍ se reescala con el lienzo: a estos tamaños queda del
          orden del contorno del bancal, que es lo que se busca. */}
      <Icon
        x={x}
        y={y}
        width={size}
        height={size}
        className={info.text}
        pointerEvents="none"
        aria-hidden
      />
    </BedFrame>
  );
}

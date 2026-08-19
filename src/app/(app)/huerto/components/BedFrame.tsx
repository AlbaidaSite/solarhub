"use client";

import type { ReactNode } from "react";
import { BED_STROKE_WIDTH } from "../lib/canvas";
import type { GardenBed } from "@/types/garden";

interface BedFrameProps {
  bed: GardenBed;
  // Etiqueta accesible del bancal cuando es clicable. Cambia con lo que
  // se esté mirando (los cultivos que tiene, o cómo está su riego), así
  // que la pone quien dibuja dentro y no este armazón.
  label: string;
  onSelect?: (bedId: number, clientX?: number, clientY?: number) => void;
  // Puntero de ratón entrando o saliendo del bancal. Se pasa el rectángulo en
  // pantalla en vez de las coordenadas del cursor para que el recuadro quede
  // anclado al bancal y no tiemble al mover el ratón por dentro.
  onHoverChange?: (bed: GardenBed | null, rect?: DOMRect) => void;
  children?: ReactNode;
}

// Contorno de un bancal y todo su comportamiento de puntero/teclado,
// compartido por las dos lecturas del lienzo: los cultivos (BedShape) y
// el riego (IrrigationBedShape). Lo que cambia entre una y otra es solo
// lo que se dibuja DENTRO, que llega como children.
//
// Se extrajo al añadir la vista de riego: son ~40 líneas de detalles
// sutiles (qué eventos se paran, por qué el relleno es transparente y no
// "none", cuándo cuenta el hover) que no deben existir dos veces.
export default function BedFrame({
  bed,
  label,
  onSelect,
  onHoverChange,
  children,
}: BedFrameProps) {
  const interactive = onSelect != null;

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
      // El <g> es el objetivo de clic entero (contorno + contenido): un
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

      {children}
    </g>
  );
}

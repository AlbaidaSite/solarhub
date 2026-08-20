"use client";

import { useCallback, useId, useState, type RefObject } from "react";
import BedShape, { type BedPreview } from "./BedShape";
import IrrigationBedShape from "./IrrigationBedShape";
import { BED_STROKE_WIDTH, CANVAS_VIEWBOX, GARDEN_CANVAS } from "../lib/canvas";
import { bedCropLines, bedSummary } from "../lib/bedCrops";
import { irrigationInfo } from "../lib/irrigation";
import { plantColorClasses } from "@/lib/plantColorClasses";
import type { GardenBed, GardenBoard, IrrigationLevel, Plant, PlantBed } from "@/types/garden";

// Separación entre el recuadro y el borde del bancal al que se ancla.
const TOOLTIP_GAP = 10;

// Si al bancal le quedan menos de estos píxeles por encima, el recuadro no
// cabe arriba y se coloca debajo. Es holgado a propósito: cubre un bancal con
// muchos cultivos sin tener que medir el recuadro antes de pintarlo.
const TOOLTIP_FLIP_SPACE = 200;

// Ancho máximo del recuadro. Se usa además para no dejar que se salga por los
// lados: como va centrado sobre el bancal, basta con acotar ese centro a media
// anchura de cada borde.
const TOOLTIP_MAX_WIDTH = 288;
const TOOLTIP_EDGE_MARGIN = 8;

interface BedTooltip {
  bed: GardenBed;
  // Centro horizontal del bancal y borde al que se ancla, en coordenadas de
  // viewport (el recuadro se posiciona con `fixed`).
  x: number;
  y: number;
  below: boolean;
}

export interface CanvasPreview extends BedPreview {
  bedId: number;
}

interface GardenCanvasProps {
  beds: GardenBed[];
  distribution: Map<number, PlantBed[]>;
  plantsById: Map<number, Plant>;
  // Qué lectura del huerto se pinta: los cultivos de un modo, o el riego.
  board: GardenBoard;
  // Nivel de riego por bancal. Solo se lee en la lectura de riego, pero
  // llega siempre: es un Map diminuto y así el lienzo no tiene props que
  // aparezcan y desaparezcan con el board.
  irrigationByBed: Map<number, IrrigationLevel>;
  // Solo lo reciben quienes pueden actuar sobre un bancal en la lectura que
  // se esté mirando. Su ausencia es lo que hace el lienzo puramente
  // informativo: en riego eso es todo el mundo salvo garden manager y staff;
  // en cultivos, cualquiera puede abrir un bancal para consultarlo.
  onBedSelect?: (bedId: number, clientX?: number, clientY?: number) => void;
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
  board,
  irrigationByBed,
  onBedSelect,
  preview,
  svgRef,
}: GardenCanvasProps) {
  const titleId = useId();
  const isIrrigation = board.kind === "irrigation";
  const interactive = onBedSelect != null;
  const canvasLabel = isIrrigation
    ? "Riego del huerto"
    : `Distribución ${board.mode === "actual" ? "actual" : "planificada"} del huerto`;

  // El recuadro de hover lo lleva el lienzo y no cada bancal: es HTML, y
  // dentro del <svg> no tendría dónde vivir.
  const [tooltip, setTooltip] = useState<BedTooltip | null>(null);

  const handleHoverChange = useCallback((bed: GardenBed | null, rect?: DOMRect) => {
    if (!bed || !rect) {
      setTooltip(null);
      return;
    }
    const below = rect.top < TOOLTIP_FLIP_SPACE;
    const half = TOOLTIP_MAX_WIDTH / 2 + TOOLTIP_EDGE_MARGIN;
    const center = rect.left + rect.width / 2;
    setTooltip({
      bed,
      x: Math.min(Math.max(center, half), window.innerWidth - half),
      y: below ? rect.bottom + TOOLTIP_GAP : rect.top - TOOLTIP_GAP,
      below,
    });
  }, []);

  const tooltipRows = tooltip ? distribution.get(tooltip.bed.id) ?? [] : [];
  const tooltipLines = bedCropLines(tooltipRows, plantsById);
  const tooltipIrrigation = tooltip ? irrigationInfo(irrigationByBed.get(tooltip.bed.id)) : null;

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
          // BedFrame); la lista sr-only de abajo cubre el caso de solo
          // lectura, donde no hay nada que enfocar.
          role={interactive ? "group" : "img"}
          aria-labelledby={interactive ? undefined : titleId}
          aria-label={interactive ? canvasLabel : undefined}
          // El contenedor (ver HuertoView) ya tiene un alto acotado por
          // el layout real -- navbar, BoardToggle, pestañas, márgenes --
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
          {beds.map((bed) =>
            isIrrigation ? (
              <IrrigationBedShape
                key={bed.id}
                bed={bed}
                level={irrigationByBed.get(bed.id)}
                onSelect={onBedSelect}
                onHoverChange={handleHoverChange}
              />
            ) : (
              <BedShape
                key={bed.id}
                bed={bed}
                // Ya vienen ordenados por order_number (bedsForDistribution).
                rows={distribution.get(bed.id) ?? []}
                plantsById={plantsById}
                preview={preview?.bedId === bed.id ? preview : null}
                onSelect={onBedSelect}
                onHoverChange={handleHoverChange}
              />
            ),
          )}
        </svg>
      </div>

      {/* Aria-hidden porque duplica lo que ya anuncian aria-label (bancal
          clicable) o la lista sr-only de abajo: un lector de pantalla no debe
          leerlo dos veces, y con el puntero encima tampoco puede estorbar. */}
      {tooltip && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-lg border border-white/15 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            maxWidth: TOOLTIP_MAX_WIDTH,
            transform: `translate(-50%, ${tooltip.below ? "0" : "-100%"})`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {tooltip.bed.name}
          </p>
          {/* En riego el recuadro dice el nivel. Si siguiera listando
              cultivos, un bancal plantado se leería igual en las dos
              lecturas, y uno vacío diría "Vacío" hablando de otra cosa. */}
          {isIrrigation && tooltipIrrigation ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-white">
              <tooltipIrrigation.Icon
                size={16}
                className={`shrink-0 ${tooltipIrrigation.text}`}
              />
              {tooltipIrrigation.label}
            </p>
          ) : tooltipLines.length === 0 ? (
            <p className="mt-1 text-sm text-white/60">Vacío</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {tooltipLines.map((line) => (
                <li key={line.key} className="flex items-center gap-2 text-sm text-white">
                  {/* Mismo color que su subcelda en el lienzo: es lo que ata
                      cada línea con la porción de bancal que le corresponde. */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${plantColorClasses(line.color).bg}`}
                  />
                  <span>
                    {line.name}
                    {line.type && <span className="text-white/50"> ({line.type})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!interactive && (
        <ul className="sr-only">
          {beds.map((bed) => (
            <li key={bed.id}>
              {isIrrigation
                ? `${bed.name}: riego ${irrigationInfo(irrigationByBed.get(bed.id)).label.toLowerCase()}`
                : bedSummary(bed, distribution.get(bed.id) ?? [], plantsById)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

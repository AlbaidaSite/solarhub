"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useIsMobile } from "@/hooks/useIsMobile";
import ModeToggle from "./ModeToggle";
import GardenCanvas, { type CanvasPreview } from "./GardenCanvas";
import CropPanel from "./CropPanel";
import BedModal from "./BedModal";
import HuertoTabs, { HUERTO_TAB_IDS, type HuertoTab } from "./HuertoTabs";
import { bedsForDistribution } from "../lib/bedsForDistribution";
import { canAddCrop } from "../lib/subcells";
import { bedAtPoint, insertionIndexFor } from "../lib/dropTarget";
import { clientToCanvasPoint } from "../lib/canvasPoint";
import { addPlantBedAction, getGardenPermissionAction } from "../actions";
import type { GardenBed, GardenMode, Plant, PlantBed } from "@/types/garden";

interface HuertoViewProps {
  plants: Plant[];
  beds: GardenBed[];
  plantBeds: PlantBed[];
  initialMonth: number;
}

// Recorrido (en px de pantalla) a partir del cual mantener pulsado sobre
// un icono deja de ser un clic y pasa a ser un arrastre. Por debajo, al
// soltar se abre la ficha de la planta.
const DRAG_THRESHOLD = 6;

// El panel de cultivos y el lienzo solo están a la vista a la vez a
// partir de `md` (768px); por debajo son pestañas y arrastrar de uno a
// otro no significa nada. Coincide con el md: del layout de esta vista.
const DESKTOP_MIN_WIDTH = 768;

interface DragRef {
  plant: Plant;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function HuertoView({
  plants,
  beds,
  plantBeds: initialPlantBeds,
  initialMonth,
}: HuertoViewProps) {
  const [mode, setMode] = useState<GardenMode>("actual");
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<HuertoTab>("bancal");
  const [plantBeds, setPlantBeds] = useState(initialPlantBeds);
  const [canManage, setCanManage] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  // Arrastre desde el panel de cultivos. Lo que hace falta para decidir
  // (planta, puntero, si ya se movió) vive en un ref y no en el estado:
  // se actualiza en cada pointermove y no debe provocar un render ni
  // volver a suscribir los listeners. Al estado solo sube lo que se
  // pinta: el icono que sigue al cursor y la previsualización del bancal.
  const dragRef = useRef<DragRef | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ghost, setGhost] = useState<{ plant: Plant; x: number; y: number } | null>(null);
  // La previsualización se duplica en un ref porque al soltar hay que
  // leer la última, y depender del estado dentro del efecto obligaría a
  // resuscribir los listeners en cada pointermove.
  const previewRef = useRef<CanvasPreview | null>(null);
  const [preview, setPreview] = useState<CanvasPreview | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const updatePreview = useCallback((next: CanvasPreview | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const isDesktop = !useIsMobile(DESKTOP_MIN_WIDTH - 1);
  const isFuture = mode === "planificada";

  const plantsById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const distribution = useMemo(() => bedsForDistribution(plantBeds, mode), [plantBeds, mode]);

  useEffect(() => {
    getGardenPermissionAction().then((result) => setCanManage(result.canManage));
  }, []);

  // Sustituye en bloque los cultivos de un bancal en un modo por los que
  // devuelve el servidor, que ya vienen renumerados. Reproducir el
  // renumerado en cliente sería otra copia de la misma regla.
  const replaceBedRows = useCallback(
    (gardenBedId: number, rowsIsFuture: boolean, rows: PlantBed[]) => {
      setPlantBeds((prev) => [
        ...prev.filter(
          (pb) => !(pb.garden_bed_id === gardenBedId && pb.is_future === rowsIsFuture),
        ),
        ...rows,
      ]);
    },
    [],
  );

  const removeRow = useCallback((rowId: number) => {
    // Los order_number de los que quedan pueden quedar con huecos (0, 2…)
    // hasta la siguiente operación; da igual, el orden relativo es el
    // mismo y es lo único que se lee.
    setPlantBeds((prev) => prev.filter((pb) => pb.id !== rowId));
  }, []);

  const handlePlantSelect = useCallback((_plantId: number) => {
    // Modal de detalle de planta: trabajo posterior, ver seed_info /
    // harvest_info en el modelo. Handler expuesto sin implementar.
  }, []);

  // ─── Arrastrar un cultivo del panel hasta un bancal ────────────────────

  const handlePlantDragStart = (plant: Plant, event: React.PointerEvent) => {
    event.preventDefault();
    dragRef.current = {
      plant,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const finish = () => {
      dragRef.current = null;
      setIsDragging(false);
      setGhost(null);
      updatePreview(null);
    };

    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      if (!drag.moved) {
        const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (distance < DRAG_THRESHOLD) return;
        drag.moved = true;
      }

      setGhost({ plant: drag.plant, x: e.clientX, y: e.clientY });

      const point = clientToCanvasPoint(svgRef.current, e.clientX, e.clientY);
      const bed = point ? bedAtPoint(beds, point) : null;
      if (!bed || !point) {
        updatePreview(null);
        return;
      }

      // Un bancal que ya no admite más cultivos no previsualiza nada: sin
      // hueco marcado, soltar encima tampoco hace nada.
      const rows = distribution.get(bed.id) ?? [];
      if (!canAddCrop(bed, rows.length)) {
        updatePreview(null);
        return;
      }

      updatePreview({
        bedId: bed.id,
        plant: drag.plant,
        index: insertionIndexFor(bed, rows.length, point),
      });
    };

    const handleUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      // Mantener pulsado sin mover es un clic: abre la ficha de la planta
      // en vez de plantar nada.
      if (!drag.moved) {
        handlePlantSelect(drag.plant.id);
        finish();
        return;
      }

      const drop = previewRef.current;
      if (!drop) {
        finish();
        return;
      }

      finish();
      setDropError(null);
      addPlantBedAction({
        gardenBedId: drop.bedId,
        plantId: drop.plant.id,
        // Soltar planta directamente, sin tipo: se le pone después con el
        // botón de editar del modal si hace falta.
        description: null,
        isFuture,
        index: drop.index,
      }).then((result) => {
        if (result.ok) {
          replaceBedRows(drop.bedId, isFuture, result.rows);
        } else {
          setDropError(result.error);
        }
      });
    };

    const handleCancel = () => finish();

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [isDragging, beds, distribution, isFuture, handlePlantSelect, replaceBedRows, updatePreview]);

  // ─── Modal de bancal ───────────────────────────────────────────────────

  const selectedBed = selectedBedId != null ? beds.find((b) => b.id === selectedBedId) : undefined;
  const selectedRows = selectedBedId != null ? distribution.get(selectedBedId) ?? [] : [];

  return (
    // Altura explícita en vez de heredar h-full: el padding superior
    // del navbar (pt-32 = 8rem, ver (app)/layout.tsx) vive en el <main>
    // compartido por toda la app, cuyo wrapper de {children} no tiene
    // min-h-0 -- así que un simple h-full no acota nada aquí (el
    // ancestro se estiraría con el contenido en vez de al revés). Con
    // el alto ya resuelto explícitamente, el resto de la cadena
    // (min-h-0 hacia abajo) sí reparte el hueco real correctamente.
    <div
      className={`flex flex-col gap-4 h-[calc(100dvh-8rem)] min-h-0 ${
        isDragging ? "select-none" : ""
      }`}
    >
      <HuertoTabs tab={tab} onChange={setTab} />

      <div className="flex flex-col gap-4 flex-1 min-h-0 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
        <section
          id={HUERTO_TAB_IDS.bancalPanel}
          role="tabpanel"
          aria-labelledby={HUERTO_TAB_IDS.bancalTab}
          className={`${tab === "bancal" ? "flex" : "hidden"} md:flex flex-col gap-4 h-full min-h-0`}
        >
          <ModeToggle mode={mode} onChange={setMode} />
          {dropError && (
            <p role="alert" className="text-sm text-red-400 text-center">
              {dropError}
            </p>
          )}
          {/* pb-6: margen respecto al borde inferior, para que el
              lienzo no quede pegado al fondo de la ventana. */}
          <div className="flex items-center justify-center flex-1 min-h-0 pb-6">
            <GardenCanvas
              beds={beds}
              distribution={distribution}
              plantsById={plantsById}
              mode={mode}
              svgRef={svgRef}
              preview={preview}
              onBedSelect={canManage ? setSelectedBedId : undefined}
            />
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
            onPlantDragStart={canManage && isDesktop ? handlePlantDragStart : undefined}
          />
        </section>
      </div>

      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <Image
            src={ghost.plant.icon_path}
            alt=""
            fill
            sizes="56px"
            className="object-contain"
            draggable={false}
          />
        </div>
      )}

      {selectedBed && (
        <BedModal
          bed={selectedBed}
          rows={selectedRows}
          plants={plants}
          plantsById={plantsById}
          month={month}
          isFuture={isFuture}
          onClose={() => setSelectedBedId(null)}
          onRowsChange={(rows) => replaceBedRows(selectedBed.id, isFuture, rows)}
          onRowDeleted={removeRow}
        />
      )}
    </div>
  );
}

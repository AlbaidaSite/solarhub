"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useIsMobile } from "@/hooks/useIsMobile";
import BoardToggle from "./BoardToggle";
import GardenCanvas, { type CanvasPreview } from "./GardenCanvas";
import CropPanel from "./CropPanel";
import BedModal from "./BedModal";
import PlantModal from "./PlantModal";
import IrrigationModal from "./IrrigationModal";
import HuertoTabs, { HUERTO_TAB_IDS, type HuertoTab } from "./HuertoTabs";
import { bedsForDistribution } from "../lib/bedsForDistribution";
import { canAddCrop } from "../lib/subcells";
import { bedAtPoint, insertionIndexFor } from "../lib/dropTarget";
import { clientToCanvasPoint } from "../lib/canvasPoint";
import { addPlantBedAction, getGardenPermissionAction } from "../actions";
import type {
  GardenBed,
  GardenBoard,
  Irrigation,
  IrrigationLevel,
  Plant,
  PlantBed,
} from "@/types/garden";

interface HuertoViewProps {
  plants: Plant[];
  beds: GardenBed[];
  plantBeds: PlantBed[];
  irrigation: Irrigation[];
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
  plants: initialPlants,
  beds,
  plantBeds: initialPlantBeds,
  irrigation: initialIrrigation,
  initialMonth,
}: HuertoViewProps) {
  // Lectura del lienzo. Arranca en los cultivos actuales, que es lo que
  // se viene a ver; el riego es una consulta puntual.
  const [board, setBoard] = useState<GardenBoard>({ kind: "crops", mode: "actual" });
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<HuertoTab>("bancal");
  // Las plantas viven en estado (y no solo en las props) porque la ficha de
  // cultivo deja editar su información de siembra/recolecta: al guardar se
  // sustituye la planta aquí y el panel y el lienzo se enteran solos.
  const [plants, setPlants] = useState(initialPlants);
  const [plantBeds, setPlantBeds] = useState(initialPlantBeds);
  const [irrigation, setIrrigation] = useState(initialIrrigation);
  const [canManage, setCanManage] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  // Cultivo elegido en movil y a la espera de que se toque un bancal. En
  // escritorio siempre es null: alli se planta arrastrando.
  const [plantingPlantId, setPlantingPlantId] = useState<number | null>(null);
  // El servidor todavia no ha contestado a un toque anterior. Evita que dos
  // toques seguidos planten el cultivo dos veces, y no esta en el estado
  // porque no se pinta nada con el.
  const plantingPendingRef = useRef(false);

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

  // Modo de cultivos, o null si lo que se está mirando es el riego. Todo
  // lo que solo tiene sentido sobre cultivos (plantar, el modal de bancal,
  // is_future) cuelga de que esto NO sea null, en vez de asumir un modo por
  // defecto: un riego que se hiciera pasar por "actual" plantaría de verdad.
  const cropsMode = board.kind === "crops" ? board.mode : null;
  const isIrrigationBoard = board.kind === "irrigation";

  const plantsById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const distribution = useMemo(
    () => (cropsMode ? bedsForDistribution(plantBeds, cropsMode) : new Map<number, PlantBed[]>()),
    [plantBeds, cropsMode],
  );

  const irrigationByBed = useMemo(
    () => new Map(irrigation.map((row) => [row.garden_bed_id, row.irrigation_level])),
    [irrigation],
  );

  // Plantar tocando existe solo donde no existe el arrastre, y con el mismo
  // permiso: garden manager o staff. Las dos vias nunca estan activas a la vez.
  //
  // No depende de que se este mirando una lectura de cultivos, a diferencia
  // del arrastre de escritorio: la pulsacion larga se hace sobre el panel de
  // cultivos, que en movil es OTRA pestaña, asi que quien la hace no tiene
  // por que saber que el lienzo se quedo en riego. Empezar el gesto es lo
  // que devuelve el lienzo a Actual (ver startTapPlanting), en vez de no
  // hacer nada y dejar al usuario preguntandose por que.
  const canTapPlant = canManage && !isDesktop;
  const plantingPlant = plantingPlantId != null ? plantsById.get(plantingPlantId) : undefined;

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

  const handlePlantSelect = useCallback((plantId: number) => {
    setSelectedPlantId(plantId);
  }, []);

  const handlePlantChange = useCallback((updated: Plant) => {
    setPlants((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  // ─── Plantar tocando (movil) ──────────────────────────────────────────

  // Se entra desde la ficha del cultivo. Cierra los dos modales: la ficha
  // puede estar abierta ENCIMA del modal de un bancal, y dejar ese debajo
  // taparia justo los bancales que hay que tocar ahora.
  const startTapPlanting = useCallback((plantId: number) => {
    setSelectedPlantId(null);
    setSelectedBedId(null);
    setDropError(null);
    plantingPendingRef.current = false;
    setPlantingPlantId(plantId);
    setTab("bancal");
    // En riego no hay donde plantar, asi que hay que volver a los cultivos.
    // Solo desde riego: si ya se estaba en Planificar, forzar "actual" aqui
    // plantaria en el modo equivocado a quien estuviera planificando.
    setBoard((prev) => (prev.kind === "crops" ? prev : { kind: "crops", mode: "actual" }));
  }, []);

  const cancelTapPlanting = useCallback(() => {
    setPlantingPlantId(null);
    setDropError(null);
  }, []);

  // Cambiar de pestaña cancela igual que tocar fuera de un bancal, y hace
  // falta hacerlo aqui a mano: react-aria detiene la propagacion del clic de
  // una pestaña, asi que el onClick de la raiz no llega a enterarse. Sin
  // esto el cultivo se quedaria esperando con su barra escondida en el panel
  // que se acaba de abandonar.
  const handleTabChange = useCallback((next: HuertoTab) => {
    setPlantingPlantId(null);
    setDropError(null);
    setTab(next);
  }, []);

  // Cambiar de lectura cancela lo que estuviera a medias y cierra el modal
  // del bancal abierto: el de cultivos y el de riego no son el mismo, y
  // dejar uno abierto al cambiar mostraria datos de la lectura anterior.
  const handleBoardChange = useCallback((next: GardenBoard) => {
    setPlantingPlantId(null);
    setDropError(null);
    setSelectedBedId(null);
    setBoard(next);
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
    if (!isDragging || cropsMode == null) return;
    const isFuture = cropsMode === "planificada";

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
  }, [isDragging, beds, distribution, cropsMode, handlePlantSelect, replaceBedRows, updatePreview]);

  // Tocar un bancal significa una cosa u otra segun haya un cultivo a la
  // espera: plantarlo ahi, o abrir el bancal para consultarlo.
  const handleBedSelect = useCallback(
    (bedId: number, clientX?: number, clientY?: number) => {
      // Sin cultivo a la espera, tocar es abrir: el modal de cultivos o el
      // de riego, segun lo que se este mirando. Quien monta cada uno decide
      // con que permiso (ver el render).
      if (plantingPlantId == null) {
        setSelectedBedId(bedId);
        return;
      }
      if (plantingPendingRef.current || cropsMode == null) return;
      const isFuture = cropsMode === "planificada";

      const bed = beds.find((b) => b.id === bedId);
      if (!bed) return;
      const rows = distribution.get(bedId) ?? [];

      // Se planta en el punto tocado, igual que al soltar en escritorio. Sin
      // coordenadas utilizables -activacion por teclado, o un entorno sin
      // getScreenCTM- se anade al final en lugar de inventar una posicion.
      const point =
        clientX != null && clientY != null
          ? clientToCanvasPoint(svgRef.current, clientX, clientY)
          : null;
      const index =
        point && bedAtPoint([bed], point)
          ? insertionIndexFor(bed, rows.length, point)
          : rows.length;

      plantingPendingRef.current = true;
      setDropError(null);
      addPlantBedAction({
        gardenBedId: bedId,
        plantId: plantingPlantId,
        description: null,
        isFuture,
        index,
      }).then((result) => {
        plantingPendingRef.current = false;
        if (result.ok) {
          replaceBedRows(bedId, isFuture, result.rows);
          setPlantingPlantId(null);
        } else {
          // Se sigue esperando un bancal: el error suele ser "aqui no cabe",
          // y obligar a repetir el gesto entero para probar en otro sobra.
          setDropError(result.error);
        }
      });
    },
    [plantingPlantId, beds, distribution, cropsMode, replaceBedRows],
  );

  // ─── Modales de bancal ─────────────────────────────────────────────────

  const selectedBed = selectedBedId != null ? beds.find((b) => b.id === selectedBedId) : undefined;
  const selectedRows = selectedBedId != null ? distribution.get(selectedBedId) ?? [] : [];
  const selectedPlant = selectedPlantId != null ? plantsById.get(selectedPlantId) : undefined;

  // Un nivel de riego guardado sustituye a su fila en el estado. La fila
  // existe siempre (la tabla se llena por backfill y trigger), asi que no
  // hay que contemplar el alta.
  const handleIrrigationChange = useCallback((bedId: number, level: IrrigationLevel) => {
    setIrrigation((prev) =>
      prev.map((row) =>
        row.garden_bed_id === bedId ? { ...row, irrigation_level: level } : row,
      ),
    );
  }, []);

  // La ficha de cultivo puede estar ABIERTA ENCIMA del modal de bancal
  // (se abre desde su listado). Mientras lo esté, el bancal ignora su
  // propio cierre: el Escape lo consume la ficha, que se cierra sola, y
  // sin esto una sola pulsación cerraría los dos a la vez.
  const handleBedClose = useCallback(() => {
    if (selectedPlantId != null) return;
    setSelectedBedId(null);
  }, [selectedPlantId]);

  return (
    // Altura explícita en vez de heredar h-full: el padding superior
    // del navbar (pt-32 = 8rem, ver (app)/layout.tsx) vive en el <main>
    // compartido por toda la app, cuyo wrapper de {children} no tiene
    // min-h-0 -- así que un simple h-full no acota nada aquí (el
    // ancestro se estiraría con el contenido en vez de al revés). Con
    // el alto ya resuelto explícitamente, el resto de la cadena
    // (min-h-0 hacia abajo) sí reparte el hueco real correctamente.
    //
    // Por debajo de `nav` (650px) no hay navbar, solo el botón de menú
    // flotante, que acaba a 72px del borde: de los 8rem de pt-32 sobran
    // casi 4 y el lienzo se quedaba sin sitio. El margen negativo
    // recupera 3rem sin tocar el padding del <main>, que es de toda la
    // app, y el alto se ajusta en la misma medida. El punto de corte es
    // `nav` y no `md` porque lo que decide es qué navegación hay
    // arriba, no cómo se reparte esta vista.
    <div
      // Con un cultivo a la espera, cualquier toque que no sea un bancal
      // cancela: los bancales paran la propagacion (ver BedShape), asi que
      // aqui solo llega lo demas, el boton de Cancelar incluido.
      //
      // Va en pointerdown y no en click a proposito. La pulsacion larga que
      // inicia el modo termina con el dedo levantandose, y ese click de
      // rebote llegaba hasta aqui y cancelaba justo lo que acababa de
      // empezar. Su pointerdown, en cambio, sucede antes de que el modo
      // exista, asi que no puede cancelarse a si mismo.
      onPointerDown={plantingPlantId != null ? cancelTapPlanting : undefined}
      className={`flex flex-col gap-3 md:gap-4 -mt-12 h-[calc(100dvh-5rem)] nav:mt-0 nav:h-[calc(100dvh-8rem)] min-h-0 ${
        isDragging ? "select-none" : ""
      }`}
    >
      <HuertoTabs tab={tab} onChange={handleTabChange} />

      <div className="flex flex-col gap-4 flex-1 min-h-0 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
        <section
          id={HUERTO_TAB_IDS.bancalPanel}
          role="tabpanel"
          aria-labelledby={HUERTO_TAB_IDS.bancalTab}
          className={`${tab === "bancal" ? "flex" : "hidden"} md:flex flex-col gap-4 h-full min-h-0`}
        >
          <BoardToggle board={board} onChange={handleBoardChange} />
          {plantingPlant && (
            <div
              role="status"
              className="flex items-center justify-center gap-3 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2"
            >
              <div className="relative h-8 w-8 shrink-0">
                <Image
                  src={plantingPlant.icon_path}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <p className="text-sm text-white">
                Toca un bancal para plantar{" "}
                <strong className="font-semibold">{plantingPlant.name}</strong>
              </p>
              {/* No necesita onClick propio: el clic sube hasta la raiz, que
                  con un cultivo a la espera ya cancela. Es un boton de verdad
                  para que se pueda enfocar y activar con teclado. */}
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-sm text-red-300/80 transition-colors hover:text-amber-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
          {dropError && (
            <p role="alert" className="text-sm text-red-400 text-center">
              {dropError}
            </p>
          )}
          {/* pb: margen respecto al borde inferior, para que el lienzo no
              quede pegado al fondo de la ventana. Más corto en móvil, donde
              cada píxel de alto se nota en el tamaño del bancal. */}
          <div className="flex items-center justify-center flex-1 min-h-0 pb-2 md:pb-6">
            <GardenCanvas
              beds={beds}
              distribution={distribution}
              plantsById={plantsById}
              board={board}
              irrigationByBed={irrigationByBed}
              svgRef={svgRef}
              preview={preview}
              // En cultivos, abrir un bancal es consultar lo que tiene
              // plantado: no depende del permiso, y lo que decide canManage
              // es que botones enseña el modal una vez abierto. Con un
              // cultivo a la espera el mismo toque planta en vez de abrir.
              //
              // En riego es al reves: lo unico que se puede hacer con un
              // bancal ahi es cambiarle el nivel, asi que sin permiso no hay
              // nada que abrir y el bancal deja de ser clicable.
              onBedSelect={isIrrigationBoard && !canManage ? undefined : handleBedSelect}
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
            // En riego no se planta: sin este manejador, PlantRow ni siquiera
            // se marca como arrastrable (ver `draggable` alli), asi que el
            // cursor de agarre desaparece con el gesto.
            onPlantDragStart={
              canManage && isDesktop && cropsMode != null ? handlePlantDragStart : undefined
            }
            onPlantLongPress={canTapPlant ? startTapPlanting : undefined}
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

      {/* El modal de cultivos solo se monta con un modo de cultivos de
          verdad: asi isFuture no puede salir de una lectura que no es
          ninguno de los dos (ver cropsMode). */}
      {selectedBed && cropsMode != null && (
        <BedModal
          bed={selectedBed}
          rows={selectedRows}
          plants={plants}
          plantsById={plantsById}
          month={month}
          isFuture={cropsMode === "planificada"}
          canManage={canManage}
          onClose={handleBedClose}
          onRowsChange={(rows) => replaceBedRows(selectedBed.id, cropsMode === "planificada", rows)}
          onRowDeleted={removeRow}
          onPlantSelect={handlePlantSelect}
        />
      )}

      {/* Y el de riego solo en la lectura de riego. Aqui no hace falta
          comprobar el permiso: sin el, el bancal no es clicable y este
          selectedBedId no llega a existir. */}
      {selectedBed && isIrrigationBoard && (
        <IrrigationModal
          bed={selectedBed}
          level={irrigationByBed.get(selectedBed.id)}
          onClose={() => setSelectedBedId(null)}
          onLevelChange={handleIrrigationChange}
        />
      )}

      {selectedPlant && (
        <PlantModal
          plant={selectedPlant}
          canManage={canManage}
          onClose={() => setSelectedPlantId(null)}
          onPlantChange={handlePlantChange}
          onPlantHere={
            canTapPlant ? () => startTapPlanting(selectedPlant.id) : undefined
          }
        />
      )}
    </div>
  );
}

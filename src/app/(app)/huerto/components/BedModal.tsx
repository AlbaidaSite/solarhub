"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDialog, FocusScope } from "react-aria";
import { Plus, X } from "lucide-react";
import { useConfirmDelete } from "@/components/ui/useConfirmDelete";
import CropForm from "./CropForm";
import CropListRow from "./CropListRow";
import { canAddCrop } from "../lib/subcells";
import { moveItem, nearestIndex } from "../lib/reorder";
import {
  addPlantBedAction,
  deletePlantBedAction,
  reorderPlantBedsAction,
  updatePlantBedAction,
} from "../actions";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

interface BedModalProps {
  bed: GardenBed;
  // Cultivos de ESTE bancal en el modo que se está viendo, ya ordenados.
  rows: PlantBed[];
  plants: Plant[];
  plantsById: Map<number, Plant>;
  // Mes seleccionado en el panel de cultivos: ordena el desplegable.
  month: number;
  // Modo actual: los cultivos que se creen aquí nacen en el mismo modo
  // (Actual -> false, Planificada -> true) que el que se está mirando.
  isFuture: boolean;
  onClose: () => void;
  onRowsChange: (rows: PlantBed[]) => void;
  onRowDeleted: (rowId: number) => void;
}

type View = { kind: "list" } | { kind: "form"; editing: PlantBed | null };

interface DragState {
  rowId: number;
  // Centros verticales de cada hueco de la lista, medidos al empezar a
  // arrastrar. Los huecos no se mueven aunque las filas cambien de sitio,
  // así que sirven durante todo el gesto.
  midpoints: number[];
}

export default function BedModal({
  bed,
  rows,
  plants,
  plantsById,
  month,
  isFuture,
  onClose,
  onRowsChange,
  onRowDeleted,
}: BedModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { dialogProps } = useDialog({}, dialogRef);

  const [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Orden provisional mientras se arrastra una fila. Fuera del gesto es
  // null y manda `rows`: así el modal no tiene que resincronizar nada
  // cuando el padre actualiza los cultivos. Se duplica en un ref porque
  // los listeners de puntero (en window) tienen que leer el último valor
  // sin que cada movimiento los vuelva a suscribir.
  const draftRef = useRef<PlantBed[] | null>(null);
  const [draft, setDraft] = useState<PlantBed[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const updateDraft = useCallback((next: PlantBed[] | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const visibleRows = draft ?? rows;
  const canAdd = canAddCrop(bed, rows.length);

  const { openDelete, dialog: deleteDialog } = useConfirmDelete<number>({
    itemLabel: "cultivo",
    action: deletePlantBedAction,
    onSuccess: (id) => onRowDeleted(id),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  // ─── Reordenar (botón de mover) ───────────────────────────────────────
  // Los listeners van en window y no en el propio botón: durante el gesto
  // la fila cambia de sitio dentro de la lista y el puntero se sale del
  // botón enseguida.
  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const list = draftRef.current ?? rows;
      const from = list.findIndex((row) => row.id === drag.rowId);
      if (from === -1) return;

      const next = moveItem(list, from, nearestIndex(drag.midpoints, e.clientY));
      if (next !== list) updateDraft(next);
    };

    // Al soltar se persiste el orden provisional, si es que cambió algo.
    // El borrador NO se limpia hasta que responde el servidor: hacerlo
    // antes devolvería la fila a su sitio anterior durante un fotograma.
    const handleEnd = () => {
      setDrag(null);

      const reordered = draftRef.current;
      if (!reordered) return;

      const orderedIds = reordered.map((row) => row.id);
      if (orderedIds.every((id, i) => rows[i]?.id === id)) {
        updateDraft(null);
        return;
      }

      startTransition(async () => {
        const result = await reorderPlantBedsAction({
          gardenBedId: bed.id,
          isFuture,
          orderedIds,
        });
        if (result.ok) {
          onRowsChange(result.rows);
        } else {
          setError(result.error);
        }
        updateDraft(null);
      });
    };

    const handleCancel = () => {
      setDrag(null);
      updateDraft(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [drag, rows, bed.id, isFuture, onRowsChange, updateDraft]);

  const handleReorderStart = (rowId: number, event: React.PointerEvent) => {
    event.preventDefault();
    const items = listRef.current?.children;
    if (!items) return;

    const midpoints = Array.from(items).map((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    setDrag({ rowId, midpoints });
  };

  // ─── Alta y edición ───────────────────────────────────────────────────

  const handleSubmit = (values: { plantId: number; description: string | null }) => {
    const editing = view.kind === "form" ? view.editing : null;
    setError(null);

    startTransition(async () => {
      const result = editing
        ? await updatePlantBedAction({
            id: editing.id,
            plantId: values.plantId,
            description: values.description,
          })
        : await addPlantBedAction({
            gardenBedId: bed.id,
            plantId: values.plantId,
            description: values.description,
            isFuture,
            // Al añadir desde el modal el cultivo va al final; para elegir
            // sitio están el botón de mover y el arrastre desde el panel.
            index: rows.length,
          });

      if (result.ok) {
        onRowsChange(result.rows);
        setView({ kind: "list" });
      } else {
        setError(result.error);
      }
    });
  };

  // El modal no lleva título visible, pero un diálogo sin nombre
  // accesible se anuncia como "diálogo" a secas: el mismo texto que
  // llevaría la cabecera va en aria-label.
  const title = view.kind === "form" ? (view.editing ? "Editar cultivo" : "Añadir cultivo") : bed.name;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={onClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="min-h-full w-full max-w-lg mx-auto flex flex-col gap-4 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar"
            className="fixed top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={35} />
          </button>

          {view.kind === "form" ? (
            <CropForm
              plants={plants}
              month={month}
              editing={view.editing}
              isPending={isPending}
              error={error}
              onSubmit={handleSubmit}
              onCancel={() => {
                setError(null);
                setView({ kind: "list" });
              }}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView({ kind: "form", editing: null });
                }}
                disabled={!canAdd}
                title={
                  canAdd
                    ? undefined
                    : "Este bancal no admite otro cultivo: las divisiones quedarían demasiado pequeñas."
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 font-semibold text-white transition-colors hover:bg-white/20 hover:text-amber-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:text-white"
              >
                <Plus size={18} strokeWidth={2.5} />
                Añadir cultivo
              </button>

              {error && <p className="text-sm text-red-400">{error}</p>}

              {visibleRows.length === 0 ? (
                <p className="text-white/40">Este bancal está vacío.</p>
              ) : (
                <ul ref={listRef} className="flex flex-col gap-2">
                  {visibleRows.map((row) => (
                    <li key={row.id}>
                      <CropListRow
                        row={row}
                        plant={row.plant_id != null ? plantsById.get(row.plant_id) : undefined}
                        canReorder={visibleRows.length > 1}
                        isDragging={drag?.rowId === row.id}
                        onReorderStart={handleReorderStart}
                        onEdit={(target) => {
                          setError(null);
                          setView({ kind: "form", editing: target });
                        }}
                        onDelete={openDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Dentro del contenedor del diálogo, no fuera: aquí lo alcanza
              la trampa de foco del FocusScope y, sobre todo, sus clics
              mueren en el stopPropagation de este div en vez de llegar al
              fondo, que cerraría el modal de bancal entero. */}
          {deleteDialog}
        </div>
      </FocusScope>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useConfirmDelete } from "@/components/ui/useConfirmDelete";
import Triangle from "./Triangle";
import DiaryEntryForm from "./DiaryEntryForm";
import { cycleYear, diaryYears, entriesForYear, formatDiaryDate } from "../lib/diary";
import { getCurrentYearInMadrid } from "../lib/madridMonth";
import {
  addCropDiaryEntryAction,
  deleteCropDiaryEntryAction,
  getCropDiaryAction,
  updateCropDiaryEntryAction,
} from "../actions";
import type { CropDiaryEntry } from "@/types/garden";

interface CropDiaryProps {
  plantId: number;
  // Garden manager o staff: añadir, editar y borrar entradas.
  canManage: boolean;
}

type View = { kind: "list" } | { kind: "form"; editing: CropDiaryEntry | null };

// Mismo lenguaje visual que el paginador de cromos y las flechas de mes del
// panel de cultivos: sin chip de fondo, solo el triángulo cambiando a ámbar.
const NAV_ARROW_CLASS =
  "text-white transition-colors hover:text-amber-300 cursor-pointer disabled:opacity-30 disabled:hover:text-white disabled:cursor-default";

export default function CropDiary({ plantId, canManage }: CropDiaryProps) {
  // null mientras carga: distinguirlo de [] es lo que evita enseñar "no hay
  // diario" durante el viaje de ida y vuelta al servidor.
  const [entries, setEntries] = useState<CropDiaryEntry[] | null>(null);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestRequestRef = useRef<number | null>(null);

  // Mismo patrón que EventDetailModal (ver el comentario largo allí): se
  // compara contra la última petición lanzada en vez de usar un flag
  // "cancelled" por invocación, que en desarrollo con Strict Mode dejaría
  // el diario cargando para siempre.
  useEffect(() => {
    latestRequestRef.current = plantId;
    getCropDiaryAction(plantId)
      .then((rows) => {
        if (latestRequestRef.current === plantId) setEntries(rows);
      })
      .catch((err) => {
        console.error("CropDiary: fallo al cargar el diario del cultivo", err);
        if (latestRequestRef.current === plantId) setEntries([]);
      });
  }, [plantId]);

  const years = useMemo(() => diaryYears(entries ?? []), [entries]);

  // El año elegido a mano manda mientras tenga entradas; cuando deja de
  // tenerlas (se acaba de borrar la última) se cae al más reciente, que es
  // el primero de la lista.
  const year = pickedYear != null && years.includes(pickedYear) ? pickedYear : years[0];
  const visible = year != null ? entriesForYear(entries ?? [], year) : [];

  const { openDelete, dialog: deleteDialog } = useConfirmDelete<number>({
    itemLabel: "entrada del diario",
    demonstrative: "esta",
    action: deleteCropDiaryEntryAction,
    onSuccess: (id) => setEntries((prev) => prev?.filter((entry) => entry.id !== id) ?? prev),
  });

  const handleSubmit = (values: { sowYear: number; notes: string }) => {
    const editing = view.kind === "form" ? view.editing : null;
    setError(null);

    startTransition(async () => {
      const result = editing
        ? await updateCropDiaryEntryAction({ id: editing.id, ...values })
        : await addCropDiaryEntryAction({ plantId, ...values });

      if (result.ok) {
        setEntries(result.entries);
        // Se salta al año de lo que se acaba de escribir aunque se
        // estuviera mirando otro: si no, la entrada nueva desaparecería
        // nada más guardarla.
        setPickedYear(values.sowYear);
        setView({ kind: "list" });
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Diario</h2>
        {canManage && view.kind === "list" && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView({ kind: "form", editing: null });
            }}
            className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 hover:text-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            Añadir entrada
          </button>
        )}
      </div>

      {view.kind === "form" ? (
        <DiaryEntryForm
          editing={view.editing}
          defaultYear={year ?? getCurrentYearInMadrid()}
          isPending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => {
            setError(null);
            setView({ kind: "list" });
          }}
        />
      ) : entries === null ? (
        <p className="text-white/40">Cargando diario…</p>
      ) : year == null ? (
        <p className="text-white/40">Este cultivo todavía no tiene entradas de diario.</p>
      ) : (
        <>
          {/* Solo se navega por años que tienen entradas: las flechas dan
              la vuelta por los extremos (del más antiguo al más reciente)
              y con un único año no hay nada que recorrer. */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Año anterior"
              disabled={years.length < 2}
              onClick={() => setPickedYear(cycleYear(years, year, 1))}
              className={NAV_ARROW_CLASS}
            >
              <Triangle direction="left" />
            </button>
            <select
              aria-label="Año"
              value={year}
              onChange={(e) => setPickedYear(Number(e.target.value))}
              className="bg-transparent text-2xl font-bold underline decoration-1 underline-offset-4 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-black text-white">
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Año siguiente"
              disabled={years.length < 2}
              onClick={() => setPickedYear(cycleYear(years, year, -1))}
              className={NAV_ARROW_CLASS}
            >
              <Triangle direction="right" />
            </button>
          </div>

          <ul className="flex flex-col gap-3">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900 p-4"
              >
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-line break-words text-white">
                    {entry.notes ?? "Entrada sin texto."}
                  </p>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setView({ kind: "form", editing: entry });
                        }}
                        aria-label="Editar entrada del diario"
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(entry.id)}
                        aria-label="Eliminar entrada del diario"
                        title="Eliminar"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-xs text-white/40">
                  Actualizado el {formatDiaryDate(entry.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {deleteDialog}
    </section>
  );
}

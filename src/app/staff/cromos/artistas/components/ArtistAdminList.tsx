"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { deleteArtistAction } from "../actions";

interface ArtistRow {
  id: number;
  name: string;
  url: string | null;
}

interface DeleteState {
  id: number;
  step: "confirm1" | "confirm2";
}

export default function ArtistAdminList({ artists: initial }: { artists: ArtistRow[] }) {
  const [artists, setArtists] = useState<ArtistRow[]>(initial);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openDelete = (id: number) => {
    setDeleteError(null);
    setDeleteState({ id, step: "confirm1" });
  };

  const handleConfirm1 = () => setDeleteState((s) => (s ? { ...s, step: "confirm2" } : null));

  const handleConfirm2 = () => {
    if (!deleteState) return;
    const { id } = deleteState;
    startTransition(async () => {
      const result = await deleteArtistAction(id);
      if (result.ok) {
        setArtists((prev) => prev.filter((a) => a.id !== id));
        setDeleteState(null);
        setDeleteError(null);
      } else {
        setDeleteError(result.error);
      }
    });
  };

  return (
    <>
      <div className="rounded-xl border border-white/15 overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead className="bg-white/10 text-white/60 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">URL</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {artists.map((a) => (
              <tr key={a.id} className="bg-black hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-white/70">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline"
                    >
                      {a.url.length > 40 ? `${a.url.slice(0, 40)}…` : a.url}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/staff/cromos/artistas/${a.id}`}
                      aria-label="Editar artista"
                      title="Editar"
                      className="p-1.5 rounded-lg text-white/50 hover:text-amber-300 hover:bg-white/5 transition-colors"
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </Link>
                    <button
                      type="button"
                      aria-label="Eliminar artista"
                      title="Eliminar"
                      onClick={() => openDelete(a.id)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {artists.length === 0 && (
          <p className="px-4 py-8 text-center text-white/40">No hay artistas.</p>
        )}
      </div>

      {/* Confirmación de eliminación (2 pasos) */}
      {deleteState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !isPending && setDeleteState(null)}
        >
          <div
            className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteState.step === "confirm1" ? (
              <>
                <p className="text-white font-semibold text-center">
                  ¿Estás seguro de que quieres eliminar este artista?
                </p>
                {/* Rojo a la izquierda en el paso 1 */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleConfirm1}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Sí, estoy seguro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteState(null)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
                  >
                    No
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-center">
                  Esta acción no se puede deshacer. ¿Confirmar eliminación?
                </p>
                {/* Rojo a la derecha en el paso 2 — posición alternada */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteState(null)}
                    disabled={isPending}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm2}
                    disabled={isPending}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Eliminando…" : "Confirmar"}
                  </button>
                </div>
                {deleteError && (
                  <p className="text-red-400 text-sm text-center">{deleteError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

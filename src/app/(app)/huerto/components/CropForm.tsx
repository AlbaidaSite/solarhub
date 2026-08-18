"use client";

import { useMemo, useState } from "react";
import { preventEnterSubmit } from "@/lib/preventEnterSubmit";
import { monthGroups } from "../lib/monthGroups";
import { getMonthName } from "../lib/monthNames";
import type { Plant, PlantBed } from "@/types/garden";

interface CropFormProps {
  plants: Plant[];
  month: number;
  // Fila que se está editando; ausente al añadir.
  editing?: PlantBed | null;
  isPending: boolean;
  error: string | null;
  onSubmit: (values: { plantId: number; description: string | null }) => void;
  onCancel: () => void;
}

// Alta y edición comparten formulario: editar es exactamente lo mismo con
// los valores actuales precargados (y por eso el estado inicial se deriva
// de `editing`, no de un efecto que lo sincronice después).
export default function CropForm({
  plants,
  month,
  editing,
  isPending,
  error,
  onSubmit,
  onCancel,
}: CropFormProps) {
  const [plantId, setPlantId] = useState<number | "">(editing?.plant_id ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  // El desplegable pone primero lo que se puede sembrar en el mes que hay
  // elegido en el panel de cultivos, que es lo que se está mirando al
  // plantar. El resto va detrás, en un grupo aparte, para que ninguna
  // planta desaparezca del selector.
  const groups = useMemo(() => monthGroups(plants, month), [plants, month]);
  const sowable = groups.siembra;
  const sowableIds = new Set(sowable.map((p) => p.id));
  const rest = plants
    .filter((p) => !sowableIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "es-ES", { sensitivity: "base" }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (plantId === "") return;
    onSubmit({ plantId, description: description.trim() === "" ? null : description.trim() });
  };

  return (
    <form onSubmit={submit} onKeyDown={preventEnterSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-white/70">Cultivo</span>
        <select
          value={plantId}
          onChange={(e) => setPlantId(e.target.value === "" ? "" : Number(e.target.value))}
          required
          className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-white cursor-pointer"
        >
          <option value="" disabled className="bg-black text-white">
            Elige un cultivo…
          </option>
          {sowable.length > 0 && (
            <optgroup label={`Se siembran en ${getMonthName(month).toLowerCase()}`}>
              {sowable.map((plant) => (
                <option key={plant.id} value={plant.id} className="bg-black text-white">
                  {plant.name}
                </option>
              ))}
            </optgroup>
          )}
          {rest.length > 0 && (
            <optgroup label="Resto de cultivos">
              {rest.map((plant) => (
                <option key={plant.id} value={plant.id} className="bg-black text-white">
                  {plant.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-white/70">Tipo (opcional)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cherry, de pera, morado…"
          className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-white placeholder:text-white/30"
        />
        <span className="text-xs text-white/40">
          Para distinguir varios cultivos de la misma planta en el huerto.
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || plantId === ""}
          className="flex-1 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Añadir"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 rounded-xl bg-white/5 px-4 py-2 font-semibold text-white/80 transition-colors hover:bg-white/10 cursor-pointer disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

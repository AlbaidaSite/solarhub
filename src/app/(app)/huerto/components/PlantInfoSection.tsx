"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import MonthPicker from "./MonthPicker";
import { formatMonthList } from "../lib/monthNames";
import { updatePlantSectionAction, type PlantSection } from "../actions";
import type { Plant } from "@/types/garden";

interface PlantInfoSectionProps {
  section: PlantSection;
  plant: Plant;
  // Garden manager o staff. Es lo único que decide si aparece el lápiz:
  // el resto de la ficha se ve igual con permiso y sin él.
  canManage: boolean;
  onPlantChange: (plant: Plant) => void;
}

// Las dos mitades de la ficha son el mismo bloque con distintos textos y
// distinto par de columnas; solo cambia lo que hay en esta tabla.
const SECTION_TEXT: Record<
  PlantSection,
  { title: string; monthsLabel: string; infoLabel: string; empty: string }
> = {
  siembra: {
    title: "Siembra",
    monthsLabel: "Meses de siembra",
    infoLabel: "Información de siembra",
    empty: "Sin información de siembra.",
  },
  recolecta: {
    title: "Recolecta",
    monthsLabel: "Meses de recolecta",
    infoLabel: "Información de recolecta",
    empty: "Sin información de recolecta.",
  },
};

function sectionValues(plant: Plant, section: PlantSection) {
  return section === "siembra"
    ? { info: plant.seed_info, months: plant.months_of_growth ?? [] }
    : { info: plant.harvest_info, months: plant.months_of_harvest ?? [] };
}

export default function PlantInfoSection({
  section,
  plant,
  canManage,
  onPlantChange,
}: PlantInfoSectionProps) {
  const text = SECTION_TEXT[section];
  const current = sectionValues(plant, section);

  const [isEditing, setIsEditing] = useState(false);
  const [info, setInfo] = useState("");
  const [months, setMonths] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El formulario nace con lo que hay guardado en ese momento, sin efecto
  // que lo sincronice después: mientras está abierto manda lo que se está
  // escribiendo, no la planta del padre.
  const startEditing = () => {
    setInfo(current.info ?? "");
    setMonths(current.months);
    setError(null);
    setIsEditing(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updatePlantSectionAction({
        plantId: plant.id,
        section,
        info,
        months,
      });

      if (result.ok) {
        onPlantChange(result.plant);
        setIsEditing(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">{text.title}</h2>
        {canManage && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Editar ${text.title.toLowerCase()}`}
            title="Editar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white/70">{text.infoLabel}</span>
            <textarea
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              rows={3}
              placeholder="Cómo, dónde, con qué cuidados…"
              className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-white placeholder:text-white/30"
            />
          </label>

          <MonthPicker legend={text.monthsLabel} months={months} onChange={setMonths} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsEditing(false);
              }}
              disabled={isPending}
              className="flex-1 rounded-xl bg-white/5 px-4 py-2 font-semibold text-white/80 transition-colors hover:bg-white/10 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={`text-base whitespace-pre-line ${current.info ? "text-white" : "text-white/40"}`}>
            {current.info ?? text.empty}
          </p>
          {/* Etiqueta y meses en un solo nodo de texto, sin partirlo en
              varios <span>: es una frase, y así se lee (y se busca) como
              tal. */}
          <p className="text-lg text-white/70">
            {`${text.monthsLabel}: ${formatMonthList(current.months) || "sin definir"}`}
          </p>
        </>
      )}
    </section>
  );
}

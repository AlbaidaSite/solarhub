"use client";

import { Fragment } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageOff, MapPin } from "lucide-react";
import { madridIsoDate } from "@/app/(app)/eventos/lib/formatting";
import type { HistoryEntry } from "../actions";
import DayGroupBox, { groupByDay } from "./DayGroupBox";

interface HistoryListProps {
  entries: HistoryEntry[];
}

// "YYYY-MM" del día en el que cayó el movimiento visto desde Madrid. Se
// deriva de la fecha ya proyectada (no del instante ISO en crudo) porque
// un registro de las 00:30 de Madrid es 22:30 UTC del día anterior: sin
// proyectar, la cabecera de mes se equivocaría en los cambios de mes.
function monthKey(day: string): string {
  return day.slice(0, 7);
}

// "Agosto 2026" — a diferencia de "Próximos Eventos", aquí sí va el año:
// el historial mira hacia atrás y puede cruzar varios.
function monthLabel(day: string): string {
  const [year, month] = day.split("-").map(Number);
  const raw = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)} ${year}`;
}

// "Historial" del perfil: cromos registrados y pines del mapa, del más
// reciente al más antiguo (máximo 20, ver getProfileHistoryAction). Misma
// estructura que "Próximos Eventos" — cabecera de mes, un recuadro por día
// con su insignia de fecha, miniatura y dos líneas de texto — pero sin la
// campana de interés, que aquí no tiene sentido: son cosas que YA han
// pasado.
export default function HistoryList({ entries }: HistoryListProps) {
  const router = useRouter();

  if (entries.length === 0) {
    return <p className="text-white/50 text-sm">Aún no se ha realizado ningún movimiento</p>;
  }

  const days = groupByDay(entries, (entry) => madridIsoDate(entry.createdAt));

  return (
    <ul className="flex w-full max-h-[60vh] flex-col gap-2 overflow-y-auto scrollbar-clean pr-1">
      {days.map((group, index) => {
        const showMonthHeader = index === 0 || monthKey(group.day) !== monthKey(days[index - 1].day);

        return (
          <Fragment key={group.day}>
            {showMonthHeader && (
              <li className="px-1 pt-2 text-sm font-semibold text-white/70 first:pt-0">
                {monthLabel(group.day)}
              </li>
            )}
            <li>
              <DayGroupBox day={group.day}>
                {group.items.map((entry) => {
                  const href = entry.href;
                  return (
                    <HistoryRow
                      key={entry.key}
                      entry={entry}
                      onSelect={href ? () => router.push(href) : undefined}
                    />
                  );
                })}
              </DayGroupBox>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

// Clases completas y literales (nada de `border-${x}`) por el escáner de
// Tailwind, mismo motivo que ROW_CLASSES en EventListRow.tsx.
//
// El contorno de la miniatura es lo único que distingue las dos fuentes de
// un vistazo, igual que el borde por tipo de evento de EventListRow.tsx.
const THUMB_BORDER_CLASSES = {
  cromo: "border-amber-500",
  pin: "border-green-700",
};

const ROW_CLASSES = {
  interactive: "hover:bg-white/5 cursor-pointer",
  static: "cursor-default",
};

function HistoryRow({ entry, onSelect }: { entry: HistoryEntry; onSelect?: () => void }) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={`flex items-center gap-3 rounded-lg p-1 transition-colors ${
        onSelect ? ROW_CLASSES.interactive : ROW_CLASSES.static
      }`}
    >
      <div
        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${
          THUMB_BORDER_CLASSES[entry.kind]
        }`}
      >
        {entry.imageUrl ? (
          <Image
            src={entry.imageUrl}
            alt=""
            fill
            sizes="48px"
            // object-contain en los pines (la pegatina es un icono con
            // transparencia, recortarlo lo mutila) y object-cover en los
            // cromos, cuyo frontal sí llena el hueco.
            className={entry.kind === "pin" ? "object-contain p-1" : "object-cover"}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/10">
            {entry.kind === "pin" ? (
              <MapPin size={22} className="text-white/60" />
            ) : (
              <ImageOff size={22} className="text-white/60" />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <span className="text-white font-medium truncate">{entry.title}</span>
        {entry.subtitle && <span className="text-sm text-white/50 truncate">{entry.subtitle}</span>}
      </div>
    </div>
  );
}

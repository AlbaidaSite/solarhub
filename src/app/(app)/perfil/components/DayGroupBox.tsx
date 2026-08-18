"use client";

import { Children, Fragment, type ReactNode } from "react";

// Las partes Y-M-D que llegan aquí ya vienen proyectadas al día real en
// Europe/Madrid, así que la insignia se construye en UTC a partir de ellas:
// volver a aplicar una zona horaria encima desplazaría el día.
const WEEKDAY_TZ = "UTC";

// Agrupa una lista YA ordenada por fecha en tramos consecutivos del mismo
// día. Al ser consecutivos no hace falta un Map ni reordenar: en cuanto
// cambia la clave se abre un tramo nuevo, y el orden original se conserva
// tal cual (ascendente en "Próximos Eventos", descendente en "Historial").
export function groupByDay<T>(
  items: T[],
  dayOf: (item: T) => string,
): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = [];
  for (const item of items) {
    const day = dayOf(item);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
}

interface DayGroupBoxProps {
  // "YYYY-MM-DD", ya proyectado a Europe/Madrid.
  day: string;
  children: ReactNode;
}

// Recuadro de un día, compartido por "Próximos Eventos" y "Historial": una
// sola insignia de fecha anclada a la esquina superior izquierda y, a su
// derecha, todo lo que cayó ese día apilado. El anclaje arriba (items-start,
// no items-center) es lo que la mantiene en la esquina cuando el recuadro
// crece con varias filas dentro.
//
// Lo que antes era una fila con su propio borde es ahora el caso de un
// tramo de un único elemento, así que se ve prácticamente igual que antes.
//
// El borde del recuadro no reacciona al hover: con varias filas dentro
// (unas pulsables y otras no, como los cumpleaños) iluminar la caja entera
// no diría cuál se va a abrir. Esa señal la da cada fila con su propio
// fondo (ver ROW_CLASSES en EventListRow.tsx / HistoryList.tsx).
export default function DayGroupBox({ day, children }: DayGroupBoxProps) {
  const rows = Children.toArray(children);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/20 p-2">
      <DateBadge day={day} />

      <div className="flex flex-1 flex-col min-w-0">
        {rows.map((row, index) => (
          <Fragment key={index}>
            {/* Separador entre filas del mismo día, difuminado en los dos
                extremos para que no choque contra los bordes del recuadro
                (mismo recurso que la línea divisoria de ProfilePanels.tsx,
                ahí en vertical). */}
            {index > 0 && (
              <div
                aria-hidden
                className="my-1 h-px w-full bg-linear-to-r from-transparent via-white/30 to-transparent"
              />
            )}
            {row}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Insignia de fecha: prácticamente cuadrada, dos filas — arriba (más baja)
// las tres primeras letras del día de la semana, abajo (más alta) el
// número de día.
function DateBadge({ day }: { day: string }) {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const weekdayAbbr = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: WEEKDAY_TZ })
    .format(new Date(Date.UTC(year, month - 1, dayOfMonth)))
    .replace(".", "");

  return (
    <div className="flex h-12 w-12 shrink-0 flex-col overflow-hidden rounded-lg border border-white/15 text-white">
      <div className="flex h-4 items-center justify-center bg-white/15 text-[10px] font-semibold uppercase tracking-wide">
        {weekdayAbbr}
      </div>
      <div className="flex flex-1 items-center justify-center text-lg font-bold">{dayOfMonth}</div>
    </div>
  );
}

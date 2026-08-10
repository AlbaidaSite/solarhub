"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { useCalendarCell } from "react-aria";
import type { CalendarState } from "react-stately";
import { isSameDay, today, type CalendarDate } from "@internationalized/date";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence } from "@/types/events";
import { getDefaultOccurrence, getDesktopDotSequence, getMobileDotSequence } from "../lib/eventOccurrences";
import EventImageLayer from "./EventImageLayer";
import BirthdayPills from "./BirthdayPills";
import EventDotSlider from "./EventDotSlider";

const MADRID_TZ = "Europe/Madrid";

interface CalendarCellProps {
  state: CalendarState;
  date: CalendarDate;
  occurrences: EventOccurrence[];
  stickyEventId?: number;
  isSelectedDay: boolean;
  onSelectStickyImage: (dateKey: string, eventId: number) => void;
  onEventSelect?: (eventId: number) => void;
  onDaySelect?: (dateKey: string) => void;
}

// Una sola rejilla para escritorio y móvil: los dos bloques de marcado se
// renderizan siempre y se alternan por breakpoint CSS (`hidden md:block` /
// `md:hidden`), nunca con useMediaQuery/JS, para no desajustar la
// hidratación en SSR.
export default function CalendarCell({
  state,
  date,
  occurrences,
  stickyEventId,
  isSelectedDay,
  onSelectStickyImage,
  onEventSelect,
  onDaySelect,
}: CalendarCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { cellProps, buttonProps, isOutsideVisibleRange, formattedDate } = useCalendarCell(
    { date },
    state,
    ref,
  );

  const dateKey = date.toString();
  const isToday = isSameDay(date, today(MADRID_TZ));

  const birthdays = occurrences.filter(isBirthday);
  const nonBirthdays = occurrences.filter((o) => !isBirthday(o));
  const defaultOccurrence = getDefaultOccurrence(nonBirthdays);
  const visibleEventId = stickyEventId ?? defaultOccurrence?.id ?? null;

  const desktopDots = getDesktopDotSequence(occurrences);
  const mobileDots = getMobileDotSequence(occurrences);
  const eventCount = occurrences.length;

  const longLabel = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
    date.toDate(MADRID_TZ),
  );
  const mobileAriaLabel =
    eventCount > 0
      ? `${longLabel}, ${eventCount} evento${eventCount === 1 ? "" : "s"}`
      : longLabel;

  return (
    <td {...cellProps} className={`p-0.5 align-top ${isOutsideVisibleRange ? "opacity-40" : ""}`}>
      <div {...buttonProps} ref={ref} className="block h-full w-full outline-none">
        {/* Escritorio: h-full w-full en vez de aspect-square — el tamaño ya
            no lo marca el ancho de columna, lo marca la fila (repartida por
            CalendarGrid entre el alto disponible de la página), así que la
            celda crece/encoge junto con la ventana en vez de mantenerse
            cuadrada. */}
        <div className="relative hidden h-full w-full overflow-hidden rounded-xl border border-white/10 md:block">
          <div
            className="absolute inset-0"
            onClick={() => {
              // Seleccionar el día es lo primero (futuro flujo de "crear
              // evento aquí"); si además hay un evento visible, también se
              // notifica su selección — ambos handlers son independientes.
              onDaySelect?.(dateKey);
              if (visibleEventId != null) onEventSelect?.(visibleEventId);
            }}
          >
            <EventImageLayer occurrences={nonBirthdays} visibleEventId={visibleEventId} />
            <div className="absolute inset-0 bg-black/20" />
          </div>
          {/* isolate: contexto de apilamiento propio para este contenedor,
              así el z-index de sus hijos no se compara contra el velo de
              imagen (hermano de este div) ni contra nada externo. Dentro de
              ese contexto: z-10 en el plus, z-20 en el número — ambos
              positivos y por encima del velo (que es z:auto), en vez del
              z-negativo de antes, que además de quedar detrás del número
              podía quedar detrás del propio velo si `isolate` no bastaba. */}
          <div className="absolute top-1.5 left-1.5 isolate">
            {visibleEventId == null && (
              // Detrás del número: negro, sin seleccionar. Al seleccionar el
              // día: se desliza a la derecha del número Y pasa a blanco
              // (animado). Al seleccionar OTRO día: vuelve de golpe a negro
              // y a su sitio original, sin animación — por eso el estado
              // "no seleccionado" lleva transition-none, la transición solo
              // existe al ENTRAR en el estado seleccionado (el navegador
              // solo anima si `transition` aplica en el estilo de destino).
              <Plus
                aria-hidden
                className={`pointer-events-none absolute top-1/2 left-1/2 z-10 h-5 w-5 -translate-y-1/2 ${
                  isSelectedDay
                    ? "translate-x-[calc(-50%+28px)] text-white transition-all duration-300"
                    : "-translate-x-1/2 text-black transition-none"
                }`}
              />
            )}
            <span
              className={`relative z-20 flex h-6 w-6 items-center justify-center rounded-md text-sm font-semibold ${
                isToday ? "bg-white/80 text-black" : "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
              } ${isSelectedDay ? "border-2 border-white" : ""}`}
            >
              {formattedDate}
            </span>
          </div>
          <BirthdayPills birthdays={birthdays} />
          <EventDotSlider
            dotSequence={desktopDots}
            visibleEventId={visibleEventId}
            onSelect={(eventId) => onSelectStickyImage(dateKey, eventId)}
          />
        </div>

        {/* Móvil */}
        <button
          type="button"
          onClick={() => onDaySelect?.(dateKey)}
          aria-label={mobileAriaLabel}
          className="flex w-full flex-col items-center gap-1.5 py-3 md:hidden"
        >
          <span
            className={`flex h-13 w-13 items-center justify-center rounded-lg text-xl ${
              isToday ? "bg-white/80 font-semibold text-black" : ""
            } ${isSelectedDay ? "border-[3px] border-white" : ""}`}
          >
            {formattedDate}
          </span>
          <span className="flex items-center gap-0.5">
            {mobileDots.visible.map((occurrence) => (
              <span
                key={occurrence.id}
                className={`h-1.5 w-1.5 rounded-full ${eventTypeClasses(occurrence.eventType.color).dot}`}
              />
            ))}
            {mobileDots.overflowCount > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            )}
          </span>
        </button>
      </div>
    </td>
  );
}

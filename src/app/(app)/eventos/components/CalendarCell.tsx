"use client";

import { useRef } from "react";
import { Plus, Sparkle } from "lucide-react";
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
  onEventSelect?: (eventId: number, occurrenceDate: string) => void;
  onDaySelect?: (dateKey: string) => void;
  onCreateEvent?: (dateKey: string) => void;
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
  onCreateEvent,
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
  const visibleOccurrence = nonBirthdays.find((o) => o.id === visibleEventId) ?? null;
  // Contorno de 2px: blanco por defecto, del color del tipo cuando la
  // celda está mostrando un evento. Sustituye al aro blanco que antes
  // llevaba el punto activo del slider (ver EventDotSlider.tsx) — ese
  // lenguaje visual queda libre para otro uso futuro.
  const cellBorderClass = visibleOccurrence
    ? eventTypeClasses(visibleOccurrence.eventType.color).badgeBorder
    : "border-white";

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
        <div
          className={`relative hidden h-full w-full overflow-hidden rounded-xl border-2 transition-colors md:block ${cellBorderClass}`}
        >
          <div
            className="absolute inset-0"
            onClick={() => {
              // Seleccionar el día es lo primero (futuro flujo de "crear
              // evento aquí"); si además hay un evento visible, también se
              // notifica su selección — ambos handlers son independientes.
              onDaySelect?.(dateKey);
              if (visibleEventId != null) onEventSelect?.(visibleEventId, dateKey);
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
              //
              // Solo es clicable (y navega a "crear evento este día") en su
              // posición seleccionada/visible; en cualquier otro estado
              // vuelve a pointer-events-none, así que al seleccionar OTRO
              // día este + deja de poder pulsarse automáticamente (no hace
              // falta lógica de deselección aparte).
              <Plus
                aria-hidden={!isSelectedDay}
                aria-label={isSelectedDay ? "Crear evento este día" : undefined}
                onClick={
                  isSelectedDay
                    ? (event) => {
                        event.stopPropagation();
                        onCreateEvent?.(dateKey);
                      }
                    : undefined
                }
                className={`absolute top-1/2 left-1/2 z-10 h-5 w-5 -translate-y-1/2 ${
                  isSelectedDay
                    ? "pointer-events-auto cursor-pointer translate-x-[calc(-50%+28px)] text-white transition-all duration-300"
                    : "pointer-events-none -translate-x-1/2 text-black transition-none"
                }`}
              />
            )}
            <span
              // Círculo negro sólido por defecto (antes solo llevaba
              // text-shadow): contra una imagen con mucho blanco, la sombra
              // de texto sola no bastaba para que el número siguiera
              // siendo legible. isToday sigue con su propio tratamiento
              // (círculo blanco) porque ya garantiza contraste de sobra.
              className={`relative z-20 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                isToday ? "bg-white/80 text-black" : "bg-black/80 text-white"
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
          {/* Segundo borde negro de 2px, por dentro del border-2 de color.
              Va como último hermano (no como shadow del contenedor): la capa
              de imagen/tesela de EventImageLayer es `inset-0`, así que pinta
              justo encima del box-shadow del contenedor y lo tapaba por
              completo. Como último hijo (z-index:auto, orden de documento)
              pinta por encima de todo lo demás; pointer-events-none para no
              robarle clics ni al slider de puntos ni a la celda. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_3px_black]"
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
            className={`flex h-13 w-13 items-center justify-center rounded-lg text-2xl ${
              isToday ? "bg-white/80 font-semibold text-black" : ""
            } ${isSelectedDay ? "border-[3px] border-white" : ""}`}
          >
            {formattedDate}
          </span>
          <span className="flex items-center gap-0.5">
            {/* Un único destello por día con cumpleaños, sin importar
                cuántos haya — no es un punto más de la secuencia (esos son
                solo para eventos no-cumpleaños, ver getMobileDotSequence). */}
            {birthdays.length > 0 && (
              <Sparkle aria-hidden size={12} strokeWidth={1} className="fill-amber-300 text-amber-300" />
            )}
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

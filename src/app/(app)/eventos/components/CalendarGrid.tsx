"use client";

import { useCalendarGrid, useLocale } from "react-aria";
import type { CalendarState } from "react-stately";
import { getWeeksInMonth } from "@internationalized/date";
import type { EventOccurrence } from "@/types/events";
import CalendarCell from "./CalendarCell";

interface CalendarGridProps {
  state: CalendarState;
  occurrencesByDate: Map<string, EventOccurrence[]>;
  stickyImageByDate: Map<string, number>;
  selectedDateKey: string | null;
  onSelectStickyImage: (dateKey: string, eventId: number) => void;
  onEventSelect?: (eventId: number) => void;
  onDaySelect?: (dateKey: string) => void;
  onCreateEvent?: (dateKey: string) => void;
}

export default function CalendarGrid({
  state,
  occurrencesByDate,
  stickyImageByDate,
  selectedDateKey,
  onSelectStickyImage,
  onEventSelect,
  onDaySelect,
  onCreateEvent,
}: CalendarGridProps) {
  const { locale } = useLocale();
  const { gridProps, headerProps, weekDays } = useCalendarGrid({}, state);
  const weeksInMonth = getWeeksInMonth(state.visibleRange.start, locale);

  return (
    // md:h-full: el contenedor padre (EventsCalendar) ya le da a este
    // wrapper un alto concreto (md:flex-1 md:min-h-0, hasta el borde
    // inferior de la página). Con la tabla a h-full y las filas del tbody
    // sin alto explícito, el navegador reparte el sobrante por igual entre
    // semanas — así las celdas crecen/encogen con la ventana.
    <table {...gridProps} className="w-full table-fixed border-separate border-spacing-1 md:h-full">
      <thead {...headerProps}>
        <tr>
          {weekDays.map((day, index) => (
            // Mismo p-0.5 que las <td> de abajo (misma columna, mismo
            // table-fixed) para que el pill ocupe exactamente el mismo
            // ancho que las celdas del día; el gap entre columnas ya lo da
            // el border-spacing-1 compartido por toda la tabla.
            <th key={index} className="p-0.5 pb-1.5">
              <span className="flex h-6 w-full items-center justify-center rounded-full bg-white text-xs font-medium text-black">
                {day}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...new Array(weeksInMonth).keys()].map((weekIndex) => (
          <tr key={weekIndex}>
            {state.getDatesInWeek(weekIndex).map((date, i) =>
              date ? (
                <CalendarCell
                  key={date.toString()}
                  state={state}
                  date={date}
                  occurrences={occurrencesByDate.get(date.toString()) ?? []}
                  stickyEventId={stickyImageByDate.get(date.toString())}
                  isSelectedDay={selectedDateKey === date.toString()}
                  onSelectStickyImage={onSelectStickyImage}
                  onEventSelect={onEventSelect}
                  onDaySelect={onDaySelect}
                  onCreateEvent={onCreateEvent}
                />
              ) : (
                <td key={i} />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

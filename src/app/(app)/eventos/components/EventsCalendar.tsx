"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useButton, useCalendar, useLocale, I18nProvider, type AriaButtonProps } from "react-aria";
import { useCalendarState } from "react-stately";
import { createCalendar, type CalendarDate } from "@internationalized/date";
import { ChevronDown } from "lucide-react";
import CalendarGrid from "./CalendarGrid";
import MonthYearPicker from "./MonthYearPicker";
import Triangle from "./Triangle";
import { getEventOccurrencesInRangeAction } from "../actions";
import { getMonthGridRange } from "../lib/gridRange";
import { groupOccurrencesByDate } from "../lib/eventOccurrences";
import type { EventOccurrence } from "@/types/events";

interface EventsCalendarProps {
  initialOccurrences: EventOccurrence[];
  onEventSelect?: (eventId: number) => void;
  onDaySelect?: (dateKey: string) => void;
}

function monthKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

// Mismo lenguaje visual que el paginador de cromos
// (src/components/ui/Pagination.tsx): sin chip de fondo, solo el triángulo
// cambiando a ámbar en hover y atenuándose si isDisabled.
const NAV_ARROW_CLASS =
  "text-white transition-colors hover:text-amber-300 disabled:opacity-30 disabled:hover:text-white disabled:cursor-default cursor-pointer";

// `prevButtonProps`/`nextButtonProps` de useCalendar son AriaButtonProps
// (onPress, isDisabled, onFocusChange…), pensados para pasar por
// useButton, no para spreadearse tal cual sobre un <button> del DOM.
interface CalendarNavButtonProps extends AriaButtonProps<"button"> {
  className?: string;
  children: ReactNode;
}

function CalendarNavButton({ className, children, ...ariaProps }: CalendarNavButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(ariaProps, ref);
  return (
    <button {...buttonProps} ref={ref} className={className}>
      {children}
    </button>
  );
}

export default function EventsCalendar(props: EventsCalendarProps) {
  return (
    <I18nProvider locale="es-ES">
      <EventsCalendarInner {...props} />
    </I18nProvider>
  );
}

function EventsCalendarInner({
  initialOccurrences,
  onEventSelect,
  onDaySelect,
}: EventsCalendarProps) {
  const { locale } = useLocale();
  const state = useCalendarState({ locale, createCalendar });

  const initialMonthKey = monthKey(state.visibleRange.start);

  // Caché en memoria por mes (YYYY-MM): al volver a un mes ya visitado no
  // se vuelve a pedir. Vive en estado del componente, no en localStorage.
  const [monthCache, setMonthCache] = useState<Map<string, EventOccurrence[]>>(
    () => new Map([[initialMonthKey, initialOccurrences]]),
  );
  // Selección pegajosa de imagen por día, solo relevante en escritorio.
  // Sobrevive a cambiar de mes y volver porque vive en este mismo estado.
  const [stickyImageByDate, setStickyImageByDate] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement>(null);

  // Cierra el selector de mes/año al hacer clic fuera (mismo patrón que
  // ArtistMultiSelect.tsx / TradeCromoPanel.tsx).
  useEffect(() => {
    if (!isPickerOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!pickerContainerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isPickerOpen]);

  const preloadedImages = useRef(new Set<string>());

  function preloadMonthImages(occurrences: EventOccurrence[]) {
    for (const occurrence of occurrences) {
      if (!occurrence.imageUrl || preloadedImages.current.has(occurrence.imageUrl)) continue;
      preloadedImages.current.add(occurrence.imageUrl);
      const img = new window.Image();
      img.src = occurrence.imageUrl;
    }
  }

  // Precarga las imágenes del mes inicial (las que llegaron ya desde el
  // Server Component) una sola vez al montar.
  useEffect(() => {
    preloadMonthImages(initialOccurrences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleMonthKey = monthKey(state.visibleRange.start);

  useEffect(() => {
    if (monthCache.has(visibleMonthKey)) return;

    let cancelled = false;
    const range = getMonthGridRange(state.visibleRange.start.year, state.visibleRange.start.month);
    getEventOccurrencesInRangeAction(range.start, range.end).then((occurrences) => {
      if (cancelled) return;
      preloadMonthImages(occurrences);
      setMonthCache((prev) => new Map(prev).set(visibleMonthKey, occurrences));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonthKey]);

  const occurrencesByDate = useMemo(
    () => groupOccurrencesByDate(monthCache.get(visibleMonthKey) ?? []),
    [monthCache, visibleMonthKey],
  );

  function handleSelectStickyImage(dateKey: string, eventId: number) {
    setStickyImageByDate((prev) => new Map(prev).set(dateKey, eventId));
  }

  function handleDaySelect(dateKey: string) {
    setSelectedDateKey(dateKey);
    onDaySelect?.(dateKey);
  }

  const { calendarProps, prevButtonProps, nextButtonProps, title } = useCalendar(
    { "aria-label": "Calendario de eventos" },
    state,
  );
  // El mes va en mayúsculas ("OCTUBRE de 2026"); el resto ("de 2026") se
  // deja tal cual lo formatea Intl para el locale es-ES.
  const displayTitle = title.replace(/^\S+/, (word) => word.toUpperCase());

  return (
    // Anclado arriba Y abajo en escritorio: md:h-full hace que este div
    // ocupe exactamente el alto disponible de la página (heredado del
    // flex-1 de AppLayout). La cabecera (abajo) mantiene su alto natural;
    // el contenedor de la rejilla es md:flex-1 md:min-h-0, así que se lleva
    // todo el sobrante y lo reparte entre semanas — de ahí que las celdas
    // crezcan/encojan con la ventana. Móvil no lleva h-full: sigue con su
    // flujo de página normal, sin cambios.
    <div {...calendarProps} className="flex flex-col gap-3 md:h-full">
      <div className="flex items-center justify-between px-1 md:shrink-0">
        <CalendarNavButton {...prevButtonProps} className={NAV_ARROW_CLASS} aria-label="Mes anterior">
          <Triangle direction="left" />
        </CalendarNavButton>
        <div className="relative" ref={pickerContainerRef}>
          <h2 className="contents">
            <button
              type="button"
              onClick={() => setIsPickerOpen((open) => !open)}
              aria-label="Elegir mes y año"
              aria-expanded={isPickerOpen}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-lg font-semibold transition-colors hover:text-amber-300"
            >
              {displayTitle}
              <ChevronDown size={16} className={`transition-transform ${isPickerOpen ? "rotate-180" : ""}`} />
            </button>
          </h2>
          {isPickerOpen && (
            <MonthYearPicker state={state} onClose={() => setIsPickerOpen(false)} />
          )}
        </div>
        <CalendarNavButton {...nextButtonProps} className={NAV_ARROW_CLASS} aria-label="Mes siguiente">
          <Triangle direction="right" />
        </CalendarNavButton>
      </div>
      <div className="md:min-h-0 md:flex-1">
        <CalendarGrid
          state={state}
          occurrencesByDate={occurrencesByDate}
          stickyImageByDate={stickyImageByDate}
          selectedDateKey={selectedDateKey}
          onSelectStickyImage={handleSelectStickyImage}
          onEventSelect={onEventSelect}
          onDaySelect={handleDaySelect}
        />
      </div>
    </div>
  );
}

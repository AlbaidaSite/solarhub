"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useButton, useCalendar, useLocale, I18nProvider, type AriaButtonProps } from "react-aria";
import { useCalendarState } from "react-stately";
import { createCalendar, CalendarDate } from "@internationalized/date";
import { Cake, ChevronDown, Plus } from "lucide-react";
import CalendarGrid from "./CalendarGrid";
import MonthYearPicker from "./MonthYearPicker";
import Triangle from "./Triangle";
import EventDetailModal from "./EventDetailModal";
import EventListModal from "./EventListModal";
import { getEventOccurrencesInRangeAction } from "../actions";
import { getMonthGridRange } from "../lib/gridRange";
import { groupOccurrencesByDate } from "../lib/eventOccurrences";
import { isBirthday, type EventOccurrence } from "@/types/events";

interface EventsCalendarProps {
  initialOccurrences: EventOccurrence[];
  onEventSelect?: (eventId: number, occurrenceDate: string) => void;
  onDaySelect?: (dateKey: string) => void;
}

// Estado de qué modal (si alguno) está abierto — vive aquí, no en contexto
// global. "detail" con from:"list" viene del modal de lista (móvil):
// EventDetailModal muestra flecha "volver" en vez de cerrar del todo, y
// volver reconstruye el modal de lista con `listDateKey`.
type EventModalState =
  | { view: "closed" }
  | { view: "list"; dateKey: string }
  | {
      view: "detail";
      eventId: number;
      occurrenceDate: string;
      from: "grid" | "list";
      listDateKey?: string;
    };

function monthKeyFromDateString(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// Preferencia de "ocultar cumpleaños": se recuerda entre visitas en
// localStorage, no en el perfil del usuario (es puramente de presentación
// del calendario en este navegador).
const HIDE_BIRTHDAYS_KEY = "eventos:hideBirthdays";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const state = useCalendarState({ locale, createCalendar });

  const [modal, setModal] = useState<EventModalState>({ view: "closed" });

  // Igual patrón que hideBirthdays más abajo: arranca en `false` en
  // servidor y en el primer render de cliente, se corrige en un efecto.
  // Hace falta para que handleDaySelect sepa si el tap actual es de
  // móvil — en escritorio, el clic en la imagen ya llama a onDaySelect a
  // la vez que a onEventSelect (ver CalendarCell.tsx), así que sin esta
  // señal no se podría distinguir "día vacío en escritorio" (no abre
  // nada) de "cualquier día con eventos en móvil" (abre la lista): ambos
  // casos llegan con la misma firma de evento.
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    // 767px: justo por debajo del breakpoint `md` de Tailwind (768px),
    // el mismo que separa los dos bloques de marcado de CalendarCell.tsx.
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Sincronía con la URL (?evento=<id>&fecha=<YYYY-MM-DD>): suprimida
  // mientras el arranque en frío (bootstrapLinkRef) está en curso, para
  // que ambos efectos no compitan por escribir la URL a la vez.
  const suppressUrlSyncRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const bootstrapLinkRef = useRef<{ eventId: number; occurrenceDate: string } | null>(null);

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

  // Arranca en `false` tanto en servidor como en el primer render de
  // cliente (para que coincidan y no haya desajuste de hidratación) y solo
  // después, en un efecto que corre exclusivamente en cliente, se lee la
  // preferencia guardada.
  const [hideBirthdays, setHideBirthdays] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(HIDE_BIRTHDAYS_KEY) === "1") {
      setHideBirthdays(true);
    }
  }, []);

  function toggleHideBirthdays() {
    setHideBirthdays((prev) => {
      const next = !prev;
      window.localStorage.setItem(HIDE_BIRTHDAYS_KEY, next ? "1" : "0");
      return next;
    });
  }

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

  const occurrencesByDate = useMemo(() => {
    const monthOccurrences = monthCache.get(visibleMonthKey) ?? [];
    const visibleOccurrences = hideBirthdays
      ? monthOccurrences.filter((o) => !isBirthday(o))
      : monthOccurrences;
    return groupOccurrencesByDate(visibleOccurrences);
  }, [monthCache, visibleMonthKey, hideBirthdays]);

  function findOccurrence(eventId: number, occurrenceDate: string): EventOccurrence | null {
    const monthOccurrences = monthCache.get(monthKeyFromDateString(occurrenceDate));
    return monthOccurrences?.find((o) => o.id === eventId) ?? null;
  }

  // Arranque en frío vía enlace compartido (?evento=&fecha=): una sola vez
  // al montar. Mueve el mes visible a la fecha del enlace — eso ya dispara
  // el efecto de arriba, que carga ese mes en monthCache — y deja la
  // apertura del modal pendiente en bootstrapLinkRef hasta que ese mes
  // llegue (ver el efecto siguiente, que observa monthCache).
  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const eventoParam = searchParams.get("evento");
    const fechaParam = searchParams.get("fecha");
    if (!eventoParam || !fechaParam) return;

    const eventId = Number(eventoParam);
    const [year, month, day] = fechaParam.split("-").map(Number);
    if (!Number.isFinite(eventId) || !year || !month || !day) return;

    suppressUrlSyncRef.current = true;
    bootstrapLinkRef.current = { eventId, occurrenceDate: fechaParam };
    state.setFocusedDate(new CalendarDate(year, month, day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando el mes del enlace pendiente termina de cargar en monthCache,
  // abre el detalle si el evento sigue existiendo ahí; si no aparece
  // (enlace obsoleto), no hace nada más — sin bucles, se limpia igual.
  useEffect(() => {
    const pending = bootstrapLinkRef.current;
    if (!pending) return;

    const monthOccurrences = monthCache.get(monthKeyFromDateString(pending.occurrenceDate));
    if (!monthOccurrences) return;

    bootstrapLinkRef.current = null;
    const found = monthOccurrences.find((o) => o.id === pending.eventId);
    if (found) {
      setModal({ view: "detail", eventId: pending.eventId, occurrenceDate: pending.occurrenceDate, from: "grid" });
    }
    suppressUrlSyncRef.current = false;
  }, [monthCache]);

  // Sincroniza la URL con el modal abierto — se suprime durante el
  // arranque en frío de arriba para que ambos no compitan.
  //
  // history.replaceState en vez de router.replace: la ruta es dinámica
  // (page.tsx llama a getEventOccurrencesInRangeAction, que depende de
  // cookies de auth), así que router.replace — aunque lleve
  // scroll:false — sigue disparando una renavegación completa (nueva
  // petición RSC visible en Network) cada vez que se abre o cierra un
  // modal. Esa renavegación competía con el fetch de precios bajo
  // demanda del modal recién montado y lo dejaba colgado a medio
  // cargar. history.replaceState solo toca la barra de direcciones
  // (para que el enlace se pueda compartir) sin pasar por el router de
  // Next, así que no reejecuta nada del lado servidor.
  useEffect(() => {
    if (suppressUrlSyncRef.current) return;

    const params = new URLSearchParams(searchParams.toString());
    if (modal.view === "detail") {
      params.set("evento", String(modal.eventId));
      params.set("fecha", modal.occurrenceDate);
    } else {
      params.delete("evento");
      params.delete("fecha");
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  function handleSelectStickyImage(dateKey: string, eventId: number) {
    setStickyImageByDate((prev) => new Map(prev).set(dateKey, eventId));
  }

  function handleEventSelect(eventId: number, occurrenceDate: string) {
    setModal({ view: "detail", eventId, occurrenceDate, from: "grid" });
    onEventSelect?.(eventId, occurrenceDate);
  }

  function handleDaySelect(dateKey: string) {
    setSelectedDateKey(dateKey);
    if (isMobileViewport) {
      const dayOccurrences = occurrencesByDate.get(dateKey) ?? [];
      if (dayOccurrences.length > 0) {
        setModal({ view: "list", dateKey });
      }
    }
    onDaySelect?.(dateKey);
  }

  function handleCreateEvent(dateKey?: string) {
    router.push(dateKey ? `/eventos/nueva?date=${dateKey}` : "/eventos/nueva");
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
      <div className="relative flex items-center justify-center gap-3 px-1 md:shrink-0">
        {/* Botón "Nuevo evento": posicionado en absoluto para no descentrar
            el grupo flecha-título-flecha (que ahora va junto, con gap-3,
            en vez de repartido a los extremos como antes). Mismo lenguaje
            visual que "Añadir Pegatina" en mapa/components/GlobeClient.tsx;
            el breakpoint es md: (no el nav: de la navbar global) porque es
            el mismo que usa el resto de esta vista para pasar a móvil
            (CalendarCell.tsx). */}
        <button
          type="button"
          onClick={() => handleCreateEvent()}
          aria-label="Nuevo evento"
          title="Nuevo evento"
          className="absolute left-1 flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:h-9 md:px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white hover:text-amber-300 transition-colors cursor-pointer"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span className="hidden md:inline text-sm font-semibold">Nuevo evento</span>
        </button>

        <CalendarNavButton {...prevButtonProps} className={NAV_ARROW_CLASS} aria-label="Mes anterior">
          <Triangle direction="left" />
        </CalendarNavButton>
        {/* Ancho fijo (no ajustado al texto): así "MAYO de 2026" y
            "SEPTIEMBRE de 2026" ocupan el mismo hueco y las flechas de
            alrededor no se desplazan al cambiar de mes — 16rem cubre con
            margen el mes más largo en es-ES ("septiembre") + " de aaaa". */}
        <div className="relative flex w-64 justify-center" ref={pickerContainerRef}>
          <h2 className="contents">
            <button
              type="button"
              onClick={() => setIsPickerOpen((open) => !open)}
              aria-label="Elegir mes y año"
              aria-expanded={isPickerOpen}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-lg font-semibold whitespace-nowrap transition-colors hover:text-amber-300"
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

        {/* Ocultar cumpleaños: espejo del botón "Nuevo evento" pero a la
            derecha y siempre icono-solo (no hace falta etiqueta en
            escritorio, es un simple interruptor). */}
        <button
          type="button"
          onClick={toggleHideBirthdays}
          aria-label={hideBirthdays ? "Mostrar cumpleaños" : "Ocultar cumpleaños"}
          aria-pressed={hideBirthdays}
          title={hideBirthdays ? "Mostrar cumpleaños" : "Ocultar cumpleaños"}
          className={`absolute right-1 flex h-9 w-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
            hideBirthdays
              ? "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-amber-300"
              : "border-amber-300/60 bg-amber-300/15 text-amber-200"
          }`}
        >
          <Cake size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div className="md:min-h-0 md:flex-1">
        <CalendarGrid
          state={state}
          occurrencesByDate={occurrencesByDate}
          stickyImageByDate={stickyImageByDate}
          selectedDateKey={selectedDateKey}
          onSelectStickyImage={handleSelectStickyImage}
          onEventSelect={handleEventSelect}
          onDaySelect={handleDaySelect}
          onCreateEvent={handleCreateEvent}
        />
      </div>

      {modal.view === "detail" &&
        (() => {
          const occurrence = findOccurrence(modal.eventId, modal.occurrenceDate);
          if (!occurrence) return null;
          const { from, listDateKey } = modal;
          return (
            <EventDetailModal
              occurrence={occurrence}
              onClose={() => setModal({ view: "closed" })}
              onBack={
                from === "list" && listDateKey
                  ? () => setModal({ view: "list", dateKey: listDateKey })
                  : undefined
              }
            />
          );
        })()}

      {modal.view === "list" &&
        (() => {
          const dateKey = modal.dateKey;
          const dayOccurrences = occurrencesByDate.get(dateKey) ?? [];
          return (
            <EventListModal
              dateKey={dateKey}
              occurrences={dayOccurrences}
              onSelectEvent={(eventId) => {
                const occurrence = dayOccurrences.find((o) => o.id === eventId);
                if (!occurrence) return;
                setModal({
                  view: "detail",
                  eventId,
                  occurrenceDate: occurrence.occurrenceDate,
                  from: "list",
                  listDateKey: dateKey,
                });
              }}
              onCreateEvent={handleCreateEvent}
              onClose={() => setModal({ view: "closed" })}
            />
          );
        })()}
    </div>
  );
}

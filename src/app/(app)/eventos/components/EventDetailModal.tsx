"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useDialog, FocusScope } from "react-aria";
import { ArrowLeft, Check, ExternalLink, Share2, Sparkles, X } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence, type EventPrice } from "@/types/events";
import { getEventPricesAction } from "../actions";
import { formatEventDateOnly, formatEventEndDate, formatEventPrice, formatEventTime } from "../lib/formatting";

interface EventDetailModalProps {
  occurrence: EventOccurrence;
  onClose: () => void;
  // Presente solo cuando el modal se abrió desde la lista de eventos del
  // día (móvil): sustituye el cierre por una flecha "volver" — Escape y el
  // botón hacen lo mismo, vuelven a la lista en vez de cerrar del todo.
  onBack?: () => void;
}

// Un cumpleaños nunca debe llegar hasta aquí (ver BirthdayPills.tsx y
// EventListModal.tsx: los cumpleaños no son clicables en ningún sitio).
// Si ocurre, es un error de programación en el llamante — se avisa fuerte
// en desarrollo en vez de renderizar un modal vacío. La comprobación va
// DESPUÉS de todos los hooks (nunca antes de un return condicional: los
// hooks deben ejecutarse siempre en el mismo orden).
export default function EventDetailModal({ occurrence, onClose, onBack }: EventDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);

  const [prices, setPrices] = useState<EventPrice[] | null>(null);
  const [copied, setCopied] = useState(false);
  const latestPriceRequestIdRef = useRef<number | null>(null);

  const goBackOrClose = onBack ?? onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goBackOrClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBack, onClose]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  // Deliberadamente NO usa el patrón "let cancelled = false" de cleanup:
  // en desarrollo, con Strict Mode, este efecto se invoca dos veces al
  // montar con el MISMO occurrence.id — y en este proyecto, de esas dos
  // invocaciones solo la PRIMERA llega a resolver de verdad (la segunda
  // se queda colgada; comprobado con logging manual). Con un flag
  // `cancelled` por invocación, esa primera respuesta llega marcada como
  // cancelada (su cleanup ya se disparó) y se descarta — spinner
  // infinito. Comparando contra el id más reciente en vez de contra un
  // flag fijo por invocación, la respuesta que sí llegue (sea de la 1ª o
  // la 2ª) se acepta igual mientras siga siendo la del evento que se
  // está mostrando.
  useEffect(() => {
    latestPriceRequestIdRef.current = occurrence.id;
    getEventPricesAction(occurrence.id)
      .then((rows) => {
        if (latestPriceRequestIdRef.current === occurrence.id) setPrices(rows);
      })
      .catch((err) => {
        // Sin esto, un fallo en la acción deja `prices` en null para
        // siempre y el spinner nunca se resuelve.
        console.error("EventDetailModal: fallo al cargar los precios del evento", err);
        if (latestPriceRequestIdRef.current === occurrence.id) setPrices([]);
      });
  }, [occurrence.id]);

  if (isBirthday(occurrence)) {
    console.error(
      "EventDetailModal: se intentó abrir el detalle de un cumpleaños; los cumpleaños no tienen modal de detalle.",
      occurrence,
    );
    return null;
  }

  const classes = eventTypeClasses(occurrence.eventType.color);
  const dateLabel = formatEventDateOnly(occurrence.occurrenceDate);
  const timeLabel = formatEventTime(occurrence.eventDate, occurrence.startTimeIncluded);
  const endDateLabel = formatEventEndDate(occurrence.endDate, occurrence.endTimeIncluded);

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("evento", String(occurrence.id));
    url.searchParams.set("fecha", occurrence.occurrenceDate);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={goBackOrClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          className="min-h-full w-full max-w-2xl mx-auto flex flex-col gap-5 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cierre / volver — mismo tratamiento que PinModal.tsx */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goBackOrClose();
            }}
            aria-label={onBack ? "Volver a la lista" : "Cerrar"}
            className="fixed top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {onBack ? <ArrowLeft size={35} /> : <X size={35} />}
          </button>

          {/* Imagen o tesela de tipo — object-contain: la imagen completa
              siempre visible, sin recortar (letterbox sobre el fondo si
              la proporción no encaja), igual criterio que el visor de
              PinModal.tsx. */}
          <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/10 shrink-0">
            {occurrence.imageUrl ? (
              <Image
                src={occurrence.imageUrl}
                alt={occurrence.title}
                fill
                sizes="(max-width: 768px) 100vw, 42rem"
                className="object-contain"
                priority
                unoptimized
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center gap-3 ${classes.dot}`}>
                <div className="relative h-16 w-16 shrink-0">
                  <Image
                    src={occurrence.eventType.icon_path}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </div>

          <h1 id="event-detail-title" {...titleProps} className="text-4xl font-bold text-white">
            {occurrence.title}
          </h1>

          <div className="flex flex-col gap-1 text-white">
            {/* Hora en su propio span con margen izquierdo (no solo un
                espacio suelto en el string): separación visual real
                respecto a la fecha, más grande que antes. */}
            <p className="flex items-baseline text-2xl font-semibold">
              <span>{dateLabel}</span>
              {timeLabel && <span className="ml-4 text-lg font-normal text-white/70">{timeLabel}</span>}
            </p>
            {endDateLabel && <p className="text-sm text-white/60">Hasta: {endDateLabel}</p>}
          </div>

          {occurrence.place && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-white/50">Lugar</span>
              <p className="text-base text-white">{occurrence.place}</p>
            </div>
          )}

          {occurrence.description && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-white/50">Información</span>
              <p className="text-base text-white whitespace-pre-line">{occurrence.description}</p>
            </div>
          )}

          {occurrence.url && (
            <a
              href={occurrence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start px-6 py-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 text-blue-300 text-base font-semibold transition-colors"
            >
              <ExternalLink size={20} />
              Más información
            </a>
          )}

          {/* Precio: nada mientras carga (prices === null) — sin spinner
              ni cabecera "Precio" de por medio, así un evento sin precio
              nunca muestra este bloque ni siquiera un instante. Solo
              aparece si la carga termina y SÍ hay filas. */}
          {prices !== null && prices.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Precio</span>
              <ul className="flex flex-col gap-1">
                {prices.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 text-white">
                    <span className="text-base text-white/80">{p.reason ?? "Entrada"}</span>
                    <span className="text-lg font-semibold">{formatEventPrice(p.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Distintivos de tipo/cromo + compartir: última fila, con el
              icono de compartir fijado al extremo derecho de la misma
              fila (ya no flotante sobre la imagen). */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-white ${classes.badgeBg} ${classes.badgeBorder}`}
              >
                <span className="relative h-4 w-4 shrink-0">
                  <Image src={occurrence.eventType.icon_path} alt="" fill sizes="16px" className="object-contain" unoptimized />
                </span>
                {occurrence.eventType.name}
              </span>
              {occurrence.includesCromo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-sm font-medium text-amber-200">
                  <Sparkles size={14} /> Incluye cromo
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {copied && (
                <span className="flex items-center gap-1 text-sm text-amber-300">
                  <Check size={16} /> Enlace copiado
                </span>
              )}
              <button
                type="button"
                onClick={handleShare}
                aria-label="Copiar enlace del evento"
                title="Compartir"
                className="p-2 rounded-full text-white/60 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Share2 size={22} />
              </button>
            </div>
          </div>
        </div>
      </FocusScope>
    </div>
  );
}

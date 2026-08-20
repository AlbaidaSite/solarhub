"use client";

import { useEffect, useRef, useState } from "react";
import { useDialog, FocusScope } from "react-aria";
import { Plus, X } from "lucide-react";
import { isBirthday, type EventOccurrence } from "@/types/events";
import { toggleEventInterestAction } from "../actions";
import EventListRow from "./EventListRow";

const MADRID_TZ = "Europe/Madrid";

interface EventListModalProps {
  dateKey: string;
  occurrences: EventOccurrence[];
  onSelectEvent: (eventId: number) => void;
  onCreateEvent: (dateKey: string) => void;
  onClose: () => void;
  // Ver EventDetailModal.tsx: mismo callback, así una campana marcada aquí
  // se refleja también en el borde del punto de tipo de evento y en la
  // propia campana del modal de detalle sin recargar el mes.
  onInterestToggled?: (eventId: number, liked: boolean) => void;
}

// Modal de lista, solo móvil. Navegación con el detalle por SUSTITUCIÓN
// (no apilado): EventsCalendar.tsx desmonta este modal y monta
// EventDetailModal en su lugar al seleccionar un evento, con una flecha
// "volver" que regresa aquí — más simple de gestionar (una sola trampa de
// foco activa a la vez, sin pelear con el gesto de retroceso del navegador).
export default function EventListModal({
  dateKey,
  occurrences,
  onSelectEvent,
  onCreateEvent,
  onClose,
  onInterestToggled,
}: EventListModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  // Ids con una llamada a toggleEventInterestAction en curso — evita doble
  // clic sobre la misma fila mientras resuelve, sin bloquear el resto.
  const [pendingInterestIds, setPendingInterestIds] = useState<Set<number>>(new Set());

  // Optimista, al estilo "like" de Instagram: la campana cambia al
  // instante (vía onInterestToggled, que actualiza la caché de meses
  // compartida en EventsCalendar.tsx — así el cambio se ve también en el
  // modal de detalle y en el punto de tipo de evento sin esperar al
  // servidor) y solo se deshace si la petición termina fallando.
  const handleToggleInterest = (occurrence: EventOccurrence) => {
    const eventId = occurrence.id;
    const nextLiked = !occurrence.liked;
    setPendingInterestIds((prev) => new Set(prev).add(eventId));
    onInterestToggled?.(eventId, nextLiked);
    toggleEventInterestAction(eventId)
      .then((result) => {
        if (result.ok) {
          if (result.liked !== nextLiked) onInterestToggled?.(eventId, result.liked);
        } else {
          onInterestToggled?.(eventId, !nextLiked);
          console.error("EventListModal: fallo al alternar el interés", result.error);
        }
      })
      .finally(() => {
        setPendingInterestIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  const headerLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: MADRID_TZ,
  }).format(new Date(`${dateKey}T00:00:00Z`));

  // Cumpleaños primero, igual que en la secuencia de puntos de la celda;
  // después el resto en el orden en que llegó del RPC (hora, luego id).
  const birthdays = occurrences.filter(isBirthday);
  const rest = occurrences.filter((o) => !isBirthday(o));
  const ordered = [...birthdays, ...rest];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={onClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-list-title"
          className="min-h-full w-full max-w-lg mx-auto flex flex-col gap-4 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar"
            className="fixed top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={35} />
          </button>

          <div className="flex items-center justify-between gap-3">
            <h1 id="event-list-title" {...titleProps} className="text-xl font-bold text-white capitalize">
              {headerLabel}
            </h1>
            <button
              type="button"
              onClick={() => onCreateEvent(dateKey)}
              aria-label="Nuevo evento este día"
              title="Nuevo evento"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {ordered.map((occurrence) => (
              <li key={occurrence.id}>
                <EventListRow
                  occurrence={occurrence}
                  onSelect={onSelectEvent}
                  onToggleInterest={handleToggleInterest}
                  isInterestPending={pendingInterestIds.has(occurrence.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </FocusScope>
    </div>
  );
}

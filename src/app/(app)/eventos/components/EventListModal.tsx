"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useDialog, FocusScope } from "react-aria";
import { Cake, Plus, X } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence } from "@/types/events";
import { formatEventTime } from "../lib/formatting";

const MADRID_TZ = "Europe/Madrid";

interface EventListModalProps {
  dateKey: string;
  occurrences: EventOccurrence[];
  onSelectEvent: (eventId: number) => void;
  onCreateEvent: (dateKey: string) => void;
  onClose: () => void;
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
}: EventListModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);

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
            {ordered.map((occurrence) => {
              const birthday = isBirthday(occurrence);
              const classes = eventTypeClasses(occurrence.eventType.color);
              const timeLabel = formatEventTime(occurrence.eventDate, occurrence.startTimeIncluded);

              return (
                <li key={occurrence.id}>
                  <div
                    role={birthday ? undefined : "button"}
                    tabIndex={birthday ? undefined : 0}
                    onClick={birthday ? undefined : () => onSelectEvent(occurrence.id)}
                    onKeyDown={
                      birthday
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelectEvent(occurrence.id);
                            }
                          }
                    }
                    className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${
                      birthday
                        ? "border-white/10 cursor-default"
                        : "border-white/10 hover:border-white/30 cursor-pointer"
                    }`}
                  >
                    <div
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${classes.badgeBorder}`}
                    >
                      {birthday ? (
                        <div className={`flex h-full w-full items-center justify-center ${classes.dot}`}>
                          <Cake size={20} className="text-white" />
                        </div>
                      ) : occurrence.imageUrl ? (
                        <Image
                          src={occurrence.imageUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center ${classes.dot}`}>
                          <div className="relative h-6 w-6">
                            <Image
                              src={occurrence.eventType.icon_path}
                              alt=""
                              fill
                              sizes="24px"
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-white font-medium truncate">{occurrence.title}</span>
                      {timeLabel && <span className="text-sm text-white/50">{timeLabel}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </FocusScope>
    </div>
  );
}

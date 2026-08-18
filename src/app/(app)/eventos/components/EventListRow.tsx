"use client";

import Image from "next/image";
import { BellOff, BellRing, Cake } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence } from "@/types/events";
import { formatEventTime, todayInMadrid } from "../lib/formatting";
import { isPastOccurrence } from "../lib/eventOccurrences";

// Fila de evento compartida entre EventListModal.tsx (listado del día,
// móvil) y UpcomingEventsList.tsx (perfil, "Eventos pendientes") — mismo
// tratamiento visual en los dos sitios, así que vive en un único
// componente en vez de duplicarse.
interface EventListRowProps {
  occurrence: EventOccurrence;
  // Ausente (o sin llamar) para cumpleaños: nunca son clicables, no tienen
  // modal de detalle (ver EventDetailModal.tsx).
  onSelect?: (eventId: number) => void;
  onToggleInterest: (occurrence: EventOccurrence) => void;
  isInterestPending: boolean;
  // "boxed" (por defecto, modal de lista del día): la fila es su propio
  // recuadro. "grouped" (perfil): la fila va dentro de un DayGroupBox que
  // ya pone el borde y la fecha, así que aquí solo queda el relleno y el
  // fondo de hover.
  variant?: "boxed" | "grouped";
}

// Clases completas y literales (no interpolación tipo `hover:${x}`): el
// escáner de Tailwind necesita ver la cadena entera en el código fuente,
// si no la purga en build.
const ROW_CLASSES = {
  boxed: {
    base: "gap-3 rounded-xl border border-white/10 p-2",
    interactive: "hover:border-white/30 cursor-pointer",
    static: "cursor-default",
  },
  grouped: {
    base: "gap-3 rounded-lg p-1",
    interactive: "hover:bg-white/5 cursor-pointer",
    static: "cursor-default",
  },
};

export default function EventListRow({
  occurrence,
  onSelect,
  onToggleInterest,
  isInterestPending,
  variant = "boxed",
}: EventListRowProps) {
  const birthday = isBirthday(occurrence);
  const classes = eventTypeClasses(occurrence.eventType.color);
  const timeLabel = formatEventTime(occurrence.eventDate, occurrence.startTimeIncluded);
  const rowVariant = ROW_CLASSES[variant];

  return (
    <div
      role={birthday ? undefined : "button"}
      tabIndex={birthday ? undefined : 0}
      onClick={birthday ? undefined : () => onSelect?.(occurrence.id)}
      onKeyDown={
        birthday
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(occurrence.id);
              }
            }
      }
      className={`flex items-center transition-colors ${rowVariant.base} ${
        birthday ? rowVariant.static : rowVariant.interactive
      }`}
    >
      <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${classes.badgeBorder}`}>
        {birthday ? (
          <div className={`flex h-full w-full items-center justify-center ${classes.dot}`}>
            <Cake size={28} className="text-amber-600" />
          </div>
        ) : occurrence.imageUrl ? (
          <Image src={occurrence.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
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

      {/* Campana de interés: a la derecha de la fila, para TODOS los
          eventos (cumpleaños incluidos) — a diferencia de editar/eliminar
          o de abrir el detalle, mostrar interés no depende de tener un
          modal de detalle al que ir. Se cae del listado en los eventos que
          ya pasaron, que no admiten interés. */}
      {!isPastOccurrence(occurrence, todayInMadrid()) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleInterest(occurrence);
          }}
          disabled={isInterestPending}
          aria-label={occurrence.liked ? "Quitar interés" : "Mostrar interés"}
          aria-pressed={occurrence.liked}
          title={occurrence.liked ? "Quitar interés" : "Mostrar interés"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-50 ${
            occurrence.liked ? "text-yellow-400 hover:text-white" : "text-white/80 hover:text-white"
          }`}
        >
          {occurrence.liked ? <BellRing size={16} /> : <BellOff size={16} />}
        </button>
      )}
    </div>
  );
}

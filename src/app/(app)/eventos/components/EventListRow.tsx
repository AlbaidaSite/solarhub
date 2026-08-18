"use client";

import Image from "next/image";
import { BellOff, BellRing, Cake } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence } from "@/types/events";
import { formatEventTime, todayInMadrid } from "../lib/formatting";
import { isPastOccurrence } from "../lib/eventOccurrences";

const WEEKDAY_TZ = "UTC";

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
  // Solo en el listado de "Eventos pendientes" del perfil: la fecha no es
  // implícita ahí (a diferencia del modal de lista, que ya tiene la fecha
  // en su cabecera).
  showDateBadge?: boolean;
  // Idem: solo el listado del perfil pide un contorno algo más claro (en
  // reposo y en hover) que el del modal de lista del día.
  lighterBorder?: boolean;
}

// Clases completas y literales (no interpolación tipo `hover:${x}`): el
// escáner de Tailwind necesita ver la cadena entera en el código fuente,
// si no la purga en build.
const BORDER_CLASSES = {
  default: {
    interactive: "border-white/10 hover:border-white/30 cursor-pointer",
    static: "border-white/10 cursor-default",
  },
  light: {
    interactive: "border-white/20 hover:border-white/40 cursor-pointer",
    static: "border-white/20 cursor-default",
  },
};

export default function EventListRow({
  occurrence,
  onSelect,
  onToggleInterest,
  isInterestPending,
  showDateBadge,
  lighterBorder,
}: EventListRowProps) {
  const birthday = isBirthday(occurrence);
  const classes = eventTypeClasses(occurrence.eventType.color);
  const timeLabel = formatEventTime(occurrence.eventDate, occurrence.startTimeIncluded);
  const borderVariant = BORDER_CLASSES[lighterBorder ? "light" : "default"];
  const borderClasses = birthday ? borderVariant.static : borderVariant.interactive;

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
      className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${borderClasses}`}
    >
      {showDateBadge && <DateBadge occurrenceDate={occurrence.occurrenceDate} />}

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

// Insignia de fecha: prácticamente cuadrada, dos filas — arriba (más baja)
// las tres primeras letras del día de la semana, abajo (más alta) el
// número de día. Se calcula sobre las partes Y-M-D de occurrenceDate
// directamente (no sobre eventDate/un instante): occurrenceDate ya viene
// proyectada a su día real en Europe/Madrid para eventos anuales, así que
// construir la fecha en UTC a partir de esas mismas partes (en vez de
// volver a aplicar una zona horaria) evita cualquier desfase de día.
function DateBadge({ occurrenceDate }: { occurrenceDate: string }) {
  const [year, month, day] = occurrenceDate.split("-").map(Number);
  const weekdayAbbr = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: WEEKDAY_TZ })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(".", "");

  return (
    <div className="flex h-12 w-12 shrink-0 flex-col overflow-hidden rounded-lg border border-white/15 text-white">
      <div className="flex h-4 items-center justify-center bg-white/15 text-[10px] font-semibold uppercase tracking-wide">
        {weekdayAbbr}
      </div>
      <div className="flex flex-1 items-center justify-center text-lg font-bold">{day}</div>
    </div>
  );
}

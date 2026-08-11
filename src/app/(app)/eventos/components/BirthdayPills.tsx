import { useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import type { EventOccurrence } from "@/types/events";
import { toggleEventInterestAction } from "../actions";

interface BirthdayPillsProps {
  birthdays: EventOccurrence[];
  // Ver EventDetailModal.tsx: mismo callback, así el interés marcado aquí
  // se refleja también en la caché de meses de EventsCalendar.tsx.
  onInterestToggled?: (eventId: number, liked: boolean) => void;
}

// Pastillas de cumpleaños, justo debajo del número de día (top-1.5..~top-8
// está reservado para el número y el icono +, así que la banda empieza en
// top-9). La pastilla ENTERA es el botón de "mostrar interés" — un
// <button>, con una campana a cada lado del título que cambia
// BellOff/BellRing según el estado; ya no hay un botón anidado ni un
// fondo circular aparte para la campana. Un cumpleaños sigue sin abrir
// modal de detalle (eso no cambia); lo único que hace ahora el clic sobre
// la pastilla es alternar el interés. El recorte de texto
// (overflow/ellipsis) es visual; el nombre completo sigue en el DOM y
// `title` da el tooltip de ratón.
export default function BirthdayPills({ birthdays, onInterestToggled }: BirthdayPillsProps) {
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  if (birthdays.length === 0) return null;

  // Optimista, al estilo "like" de Instagram — igual que el resto de
  // campanas (ver EventDetailModal.tsx): cambia al instante vía
  // onInterestToggled y solo se deshace si la petición termina fallando.
  const handleToggleInterest = (birthday: EventOccurrence) => {
    const eventId = birthday.id;
    const nextLiked = !birthday.liked;
    setPendingIds((prev) => new Set(prev).add(eventId));
    onInterestToggled?.(eventId, nextLiked);
    toggleEventInterestAction(eventId)
      .then((result) => {
        if (result.ok) {
          if (result.liked !== nextLiked) onInterestToggled?.(eventId, result.liked);
        } else {
          onInterestToggled?.(eventId, !nextLiked);
          console.error("BirthdayPills: fallo al alternar el interés", result.error);
        }
      })
      .finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      });
  };

  return (
    <div className="ev-pills absolute top-9 left-0 right-0">
      {birthdays.map((birthday) => {
        const classes = eventTypeClasses(birthday.eventType.color);
        const BellIcon = birthday.liked ? BellRing : BellOff;
        return (
          <button
            key={birthday.id}
            type="button"
            title={birthday.title}
            onClick={() => handleToggleInterest(birthday)}
            disabled={pendingIds.has(birthday.id)}
            aria-label={`${birthday.title} — ${birthday.liked ? "Quitar interés" : "Mostrar interés"}`}
            aria-pressed={birthday.liked}
            className={`ev-pill flex items-center overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-medium text-black/80 transition-colors hover:text-black cursor-pointer ${classes.pill}`}
          >
            <span className="ev-pill-icon flex shrink-0 items-center justify-center overflow-hidden">
              <BellIcon size={16} className={birthday.liked ? "text-orange-800" : ""} />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {birthday.title}
            </span>
            <span className="ev-pill-icon flex shrink-0 items-center justify-center overflow-hidden">
              <BellIcon size={16} className={birthday.liked ? "text-orange-800" : ""} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

import Image from "next/image";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import type { EventOccurrence } from "@/types/events";

interface EventImageLayerProps {
  occurrences: EventOccurrence[];
  visibleEventId: number | null;
}

// Apila TODAS las imágenes de los eventos del día en `position: absolute;
// inset: 0` y alterna cuál se ve con `opacity`. Nunca cambia el `src` de un
// único <img>: aunque el recurso esté en caché, el navegador repinta y
// produce parpadeo.
export default function EventImageLayer({ occurrences, visibleEventId }: EventImageLayerProps) {
  if (occurrences.length === 0) return null;

  return (
    <>
      {occurrences.map((occurrence) => {
        const isVisible = occurrence.id === visibleEventId;
        return (
          <div
            key={occurrence.id}
            className="absolute inset-0 transition-opacity duration-200"
            style={{ opacity: isVisible ? 1 : 0 }}
            aria-hidden={!isVisible}
          >
            {occurrence.imageUrl ? (
              <Image
                src={occurrence.imageUrl}
                alt={occurrence.title}
                fill
                sizes="(min-width: 768px) 16vw, 0px"
                className="object-cover"
              />
            ) : (
              <EventTypeTile occurrence={occurrence} />
            )}
          </div>
        );
      })}
    </>
  );
}

// Evento sin image_url: tesela compuesta con el icono del tipo centrado
// sobre fondo del color del tipo. Solo aplica a eventos normales (los
// cumpleaños nunca llegan hasta aquí: se filtran antes en CalendarCell).
function EventTypeTile({ occurrence }: { occurrence: EventOccurrence }) {
  const classes = eventTypeClasses(occurrence.eventType.color);
  return (
    <div className={`center-flex h-full w-full ${classes.dot}`}>
      <Image
        src={occurrence.eventType.icon_path}
        alt=""
        width={28}
        height={28}
        className="opacity-90"
      />
    </div>
  );
}

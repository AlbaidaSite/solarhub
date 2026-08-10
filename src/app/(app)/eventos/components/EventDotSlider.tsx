import { eventTypeClasses } from "@/lib/eventTypeClasses";
import type { DotSequence } from "../lib/eventOccurrences";

interface EventDotSliderProps {
  dotSequence: DotSequence;
  visibleEventId: number | null;
  onSelect: (eventId: number) => void;
}

// Slider de puntos, banda inferior. `onMouseEnter` y `onFocus` fijan el
// evento visible de la celda (selección pegajosa: no hay handler de
// salida — sin el manejo de foco la vista es inoperable con teclado).
export default function EventDotSlider({ dotSequence, visibleEventId, onSelect }: EventDotSliderProps) {
  const { visible, overflowCount } = dotSequence;
  if (visible.length === 0 && overflowCount === 0) return null;

  return (
    <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center">
      {/* Píldora negra compartida en vez de un contorno por punto: con un
          único evento, el padding uniforme + rounded-full da exactamente el
          mismo círculo negro que antes salía del outline de 3px de cada
          punto por separado (mismo grosor de "borde"); con varios eventos
          se convierte en una cápsula que solo rellena el hueco ENTRE puntos
          vecinos (el gap), en vez de tocarse/solaparse con el contorno del
          punto de al lado como pasaba con outlines individuales. */}
      <div className="flex items-center gap-1.25 rounded-full bg-black p-[3px]">
        {visible.map((occurrence) => {
          const classes = eventTypeClasses(occurrence.eventType.color);
          const isActive = occurrence.id === visibleEventId;
          return (
            <button
              key={occurrence.id}
              type="button"
              aria-label={occurrence.title}
              aria-current={isActive}
              onMouseEnter={() => onSelect(occurrence.id)}
              onFocus={() => onSelect(occurrence.id)}
              // Siempre grandes y sin anillo blanco: ese lenguaje visual
              // (aro en torno al punto activo) queda reservado para otro
              // uso futuro. La celda ahora señala qué evento está activo
              // con el relleno blanco del punto (el resto lleva el color
              // de su tipo) y con el color del contorno de la celda (ver
              // CalendarCell.tsx).
              className={`h-2 w-2 rounded-full transition-colors ${isActive ? "bg-white" : classes.dot}`}
            />
          );
        })}
        {overflowCount > 0 && (
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        )}
      </div>
    </div>
  );
}

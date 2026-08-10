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
    <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1">
      {visible.map((occurrence) => {
        const classes = eventTypeClasses(occurrence.eventType.color);
        const isActive = occurrence.id === visibleEventId;
        return (
          <button
            key={occurrence.id}
            type="button"
            aria-label={occurrence.title}
            onMouseEnter={() => onSelect(occurrence.id)}
            onFocus={() => onSelect(occurrence.id)}
            className={`rounded-full transition-all ${classes.dot} ${
              isActive ? "h-2.5 w-2.5 ring-2 ring-white/80" : "h-1.5 w-1.5"
            }`}
          />
        );
      })}
      {overflowCount > 0 && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      )}
    </div>
  );
}

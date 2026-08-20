import { eventTypeClasses } from "@/lib/eventTypeClasses";
import type { DotSequence } from "../lib/eventOccurrences";

interface EventDotSliderProps {
  dotSequence: DotSequence;
  visibleEventId: number | null;
  onSelect: (eventId: number) => void;
  onOpen: (eventId: number) => void;
}

// Slider de puntos, pegado a la izquierda justo debajo del número de día
// (el número ocupa hasta los 42px: top-11 lo deja rozándolo sin pisarlo).
// La banda inferior, donde vivía antes, es ahora de los cumpleaños; aquí
// arriba la píldora estorba menos porque solo ocupa lo que miden sus
// propios puntos, en vez de ir centrada en mitad de la imagen.
//
// `onMouseEnter` y `onFocus` fijan el evento visible de la celda
// (selección pegajosa: no hay handler de salida — sin el manejo de foco
// la vista es inoperable con teclado); el clic abre ya el detalle de ESE
// evento, sin pasar por la imagen. Los dos gestos son coherentes entre
// sí: al llegar el clic, el puntero lleva ya encima del punto, así que el
// evento que se abre es el mismo que la celda está mostrando.
//
// Un día con un único evento no llega hasta aquí: getDesktopDotSequence
// devuelve la secuencia vacía (ver eventOccurrences.ts).
export default function EventDotSlider({
  dotSequence,
  visibleEventId,
  onSelect,
  onOpen,
}: EventDotSliderProps) {
  const { visible, overflowCount } = dotSequence;
  if (visible.length === 0 && overflowCount === 0) return null;

  return (
    <div className="absolute top-11 left-1.5 flex items-center">
      {/* Píldora negra compartida en vez de un contorno por punto: rellena
          el hueco ENTRE puntos vecinos (el gap) en vez de tocarse o
          solaparse con el contorno del punto de al lado, como pasaba
          cuando cada punto llevaba su propio outline de 3px. */}
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
              // stopPropagation: el punto vive DENTRO del div que
              // useCalendarCell convierte en botón de celda, así que sin
              // detenerlo el mismo clic movería además el día enfocado del
              // calendario por debajo del modal recién abierto.
              onClick={(event) => {
                event.stopPropagation();
                onOpen(occurrence.id);
              }}
              // Siempre grandes. La celda señala qué evento está activo
              // con el relleno blanco del punto (el resto lleva el color
              // de su tipo) y con el color del contorno de la celda (ver
              // CalendarCell.tsx). El aro blanco de 2px sí se usa ahora:
              // marca los eventos con interés mostrado ("campana", ver
              // EventDetailModal.tsx/EventListModal.tsx).
              className={`h-3 w-3 cursor-pointer rounded-full transition-colors ${isActive ? "bg-white" : classes.dot} ${
                occurrence.liked ? "ring-2 ring-white" : ""
              }`}
            />
          );
        })}
        {overflowCount > 0 && (
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-zinc-400" />
        )}
      </div>
    </div>
  );
}

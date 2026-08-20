import { constellationSegments } from "@/lib/constellation";
import type { Dot } from "@/types/navigation";

interface ConstellationFigureProps {
  dots: Dot[];
  // Radio de la caja compartida por todas las constelaciones (ver
  // constellationExtent): el mismo para las cinco, así conservan entre
  // ellas la proporción que tienen en el navbar.
  extent: number;
  className?: string;
}

// Mismo azul que las líneas del navbar (DesktopNavbar.tsx).
const LINE_COLOR = "#9999dd";

// En unidades del viewBox, no en píxeles: el trazo crece con la
// constelación, como las estrellas. ~1px en el navbar (60px de caja) es
// bastante más fino de lo que pide este tamaño.
const LINE_WIDTH = 0.7;

// La misma constelación del navbar dibujada como <svg>, para poder
// escalarla a cualquier tamaño sin recalcular nada: las coordenadas de los
// puntos pasan tal cual al viewBox.
export default function ConstellationFigure({
  dots,
  extent,
  className,
}: ConstellationFigureProps) {
  const size = extent * 2;

  return (
    <svg
      viewBox={`${-extent} ${-extent} ${size} ${size}`}
      // El resplandor (drop-shadow) se sale de la caja; sin esto lo
      // recortaría el borde del <svg>.
      style={{ overflow: "visible" }}
      aria-hidden
      className={className}
    >
      {constellationSegments(dots).map((segment) => (
        <line
          key={segment.key}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
        />
      ))}

      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={dot.size / 2} fill="white" />
      ))}
    </svg>
  );
}

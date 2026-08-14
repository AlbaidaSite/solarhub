// `plant.color` guarda el nombre de clase Tailwind completo (matiz + tono),
// p.ej. "red-700", o null si la planta todavía no tiene color. Mismo contrato
// —y mismas cautelas— que event_type.color en eventTypeClasses.ts: no hay
// CHECK en BD (las filas se editan a mano en Supabase Studio), así que el
// formato se valida aquí de forma defensiva antes de componer clases.
//
// La regex solo comprueba la FORMA ("matiz-tono"), no que el matiz exista de
// verdad en Tailwind: "olive-400" la pasa pero no genera ninguna clase real
// (olive no está en la paleta de Tailwind), así que acabaría pintando nada
// en vez del fallback. Por eso además se comprueba el matiz contra la lista
// de los que el `@source inline(...)` de src/styles/globals.css declara: si
// no está ahí, la clase no existe en el CSS compilado, y da igual que el
// nombre suene bien. Ambas listas tienen que moverse juntas.
const COLOR_FORMAT = /^([a-z]+)-(\d{2,3})$/;

const TAILWIND_HUES = new Set([
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

const FALLBACK_COLOR = "zinc-400";

export interface PlantColorClasses {
  // Fija currentColor para el <g> del cultivo en el SVG: el contorno usa
  // stroke="currentColor" y el relleno fill="currentColor" con su opacidad,
  // así un único color alimenta las dos cosas.
  text: string;
  // Mismas clases para chips/bordes fuera del SVG (fila del modal).
  border: string;
  bg: string;
}

function normalizeColor(color: string | null): string {
  if (color == null) return FALLBACK_COLOR;

  const match = COLOR_FORMAT.exec(color);
  if (!match) {
    console.error(
      `plantColorClasses: color "${color}" no tiene el formato esperado "matiz-tono" (ej. "red-700"); usando "${FALLBACK_COLOR}".`,
    );
    return FALLBACK_COLOR;
  }

  if (!TAILWIND_HUES.has(match[1])) {
    console.error(
      `plantColorClasses: "${match[1]}" no es un matiz de Tailwind; usando "${FALLBACK_COLOR}".`,
    );
    return FALLBACK_COLOR;
  }

  return color;
}

export function plantColorClasses(color: string | null): PlantColorClasses {
  const safeColor = normalizeColor(color);
  return {
    text: `text-${safeColor}`,
    border: `border-${safeColor}`,
    bg: `bg-${safeColor}`,
  };
}

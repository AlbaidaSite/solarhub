// `event_type.color` guarda el nombre de clase Tailwind completo (matiz +
// tono), p.ej. "amber-400". No hay CHECK en BD que garantice el formato
// (decisión consciente: las filas se editan a mano en Supabase Studio), así
// que aquí se valida de forma defensiva antes de componer clases — un valor
// mal escrito no debe producir una clase Tailwind inexistente en silencio.
//
// Nota: pastilla y punto usan aquí el MISMO tono (no hay una versión más
// clara para la pastilla), porque el tono ya viene fijado en la columna en
// vez de ser compuesto por este helper.
//
// La regex solo comprueba la FORMA ("matiz-tono"), no que el matiz exista
// realmente en Tailwind: al no haber CHECK en BD, algo como "mauve-400"
// (mauve es de Radix Colors, no de Tailwind) pasaría el formato pero no
// generaría ninguna clase real. Quien rellene event_type.color a mano debe
// usar exclusivamente matices de la paleta de Tailwind.
const COLOR_FORMAT = /^[a-z]+-\d{3}$/;
const FALLBACK_COLOR = "zinc-400";

export interface EventTypeClasses {
  dot: string;
  pill: string;
  badgeBg: string;
  badgeBorder: string;
}

function normalizeColor(color: string): string {
  if (COLOR_FORMAT.test(color)) return color;
  console.error(
    `eventTypeClasses: color "${color}" no tiene el formato esperado "matiz-tono" (ej. "amber-400"); usando "${FALLBACK_COLOR}".`,
  );
  return FALLBACK_COLOR;
}

export function eventTypeClasses(color: string): EventTypeClasses {
  const safeColor = normalizeColor(color);
  return {
    dot: `bg-${safeColor}`,
    pill: `bg-${safeColor}`,
    badgeBg: `bg-${safeColor}/20`,
    badgeBorder: `border-${safeColor}`,
  };
}

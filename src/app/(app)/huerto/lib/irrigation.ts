import { Droplet, DropletOff, Droplets, type LucideIcon } from "lucide-react";
import type { IrrigationLevel } from "@/types/garden";

// Nivel con el que se lee un bancal del que no consta nada. La columna de
// la base de datos ya tiene este mismo DEFAULT y toda fila de garden_bed
// tiene su fila de riego, así que en la práctica no debería hacer falta;
// está para que el lienzo pueda pintar un bancal aunque su fila no haya
// llegado (carga a medias, un bancal recién creado en otra pestaña).
export const DEFAULT_IRRIGATION_LEVEL: IrrigationLevel = "CERRADO";

interface IrrigationLevelInfo {
  level: IrrigationLevel;
  label: string;
  Icon: LucideIcon;
  // Clase Tailwind completa (no interpolada): el escáner necesita ver la
  // cadena entera en el código fuente o la purga en build.
  text: string;
}

// Orden de presentación: de más agua a menos. Es el que usan tanto el
// modal de selección como cualquier listado, para que la posición de cada
// opción no cambie según por dónde se mire.
export const IRRIGATION_LEVELS: IrrigationLevelInfo[] = [
  { level: "ABIERTO", label: "Abierto", Icon: Droplets, text: "text-sky-400" },
  { level: "BAJO", label: "Bajo", Icon: Droplet, text: "text-sky-400" },
  { level: "CERRADO", label: "Cerrado", Icon: DropletOff, text: "text-amber-900" },
];

const BY_LEVEL = new Map(IRRIGATION_LEVELS.map((info) => [info.level, info]));

export function irrigationInfo(level: IrrigationLevel | undefined): IrrigationLevelInfo {
  return BY_LEVEL.get(level ?? DEFAULT_IRRIGATION_LEVEL) ?? BY_LEVEL.get(DEFAULT_IRRIGATION_LEVEL)!;
}

export interface Plant {
  id: number;
  name: string;
  icon_path: string;
  seed_info: string | null;
  harvest_info: string | null;
  months_of_growth: number[] | null;
  months_of_harvest: number[] | null;
  // Nombre de clase Tailwind completo (matiz + tono, ej. "amber-400"), o
  // null si la planta no tiene color asignado. Ver plantColorClasses.
  color: string | null;
}

// Una anotación del diario de un cultivo, atada al año de siembra
// (sow_year) y no a una fecha concreta: el diario se navega por años.
// Un mismo año puede tener varias entradas —no hay unicidad en BD— y la
// ficha las muestra todas juntas bajo su año.
export interface CropDiaryEntry {
  id: number;
  plant_id: number;
  sow_year: number;
  notes: string | null;
  // ISO 8601, tal cual lo devuelve PostgREST para un timestamptz.
  updated_at: string;
}

export interface GardenBed {
  id: number;
  name: string;
  width: number;
  height: number;
  pos_x: number;
  pos_y: number;
}

export interface PlantBed {
  id: number;
  plant_id: number | null;
  garden_bed_id: number;
  description: string | null;
  is_future: boolean;
  // Posición dentro de su (bancal, modo): 0, 1, 2… Dicta tanto el orden
  // del listado del modal como qué subcelda ocupa en el lienzo.
  order_number: number;
}

export type GardenMode = "actual" | "planificada";

// Nivel de riego de un bancal. Espejo del enum irrigation_level de la
// base de datos (ver 20260819120000_garden_bed_irrigation.sql), en
// mayúsculas como el resto de enums del esquema.
export type IrrigationLevel = "ABIERTO" | "BAJO" | "CERRADO";

// Fila de la tabla irrigation. Es 1:1 con garden_bed y la clave primaria
// ES garden_bed_id: toda fila de garden_bed tiene la suya (backfill +
// trigger), así que la app solo actualiza, nunca inserta.
export interface Irrigation {
  garden_bed_id: number;
  irrigation_level: IrrigationLevel;
}

// Qué se está mirando en el lienzo del huerto. Los cultivos se ven en uno
// de los dos modos (Actual / Planificar) y el riego no es ninguno de los
// dos: es otra lectura de los mismos bancales.
//
// Unión discriminada y no un tercer valor de GardenMode a propósito.
// GardenMode significa "qué conjunto de filas de plant_bed", y se traduce
// directamente a is_future (ver bedsForDistribution). Un "riego" metido
// ahí dentro se leería como is_future=false, o sea, se haría pasar por
// Actual ante BedModal y addPlantBedAction. Así el modo solo existe donde
// significa algo.
export type GardenBoard =
  | { kind: "crops"; mode: GardenMode }
  | { kind: "irrigation" };

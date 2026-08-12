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

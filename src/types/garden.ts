export interface Plant {
  id: number;
  name: string;
  icon_path: string;
  seed_info: string | null;
  harvest_info: string | null;
  months_of_growth: number[] | null;
  months_of_harvest: number[] | null;
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
}

export type GardenMode = "actual" | "planificada";

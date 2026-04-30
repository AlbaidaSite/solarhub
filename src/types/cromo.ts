export interface CromoLabels {
  has_owners: boolean;
  hide_til_registered: boolean;
  for_loukou: boolean;
}

export interface Cromo {
  id: number;
  name: string;
  number: number;
  variant: number;
  front_img: string;
}

export interface CromoRow extends Cromo {
  cromo_labels: CromoLabels | null;
}

export interface Category {
  id: number;
  name: string;
  icon_path: string;       // URL resuelta
  order_number: number;
}

export interface Rarity {
  id: number;
  name: string;
  icon_path: string;       // URL resuelta
}

export type SortBy =
  | 'number'        // Categoría(Asc) > Número(Asc)
  | 'rarity_asc'    // Rareza(Asc) > Categoría(Asc) > Número(Asc)
  | 'rarity_desc'   // Rareza(Desc) > Categoría(Asc) > Número(Asc)
  | 'name_asc'      // Nombre(Asc)
  | 'name_desc';    // Nombre(Desc)

export interface CromoDetail {
  id: number;
  name: string;
  number: number;
  variant: number;
  description: string | null;
  copies: number;
  how_to: string | null;
  how_to_extended: string | null;
  front_img: string;       // URL resuelta (full)
  front_thumb: string;     // URL resuelta (thumbnail ~400px)
  back_img: string;        // URL resuelta (full)
  isLocked: boolean;
  rarity: { id: number; name: string; icon_path: string } | null;
  category: { id: number; name: string; icon_path: string; order_number: number } | null;
  artists: Array<{ name: string; url: string | null }>;
}

export interface User {
  id: number;
  name: string;
}
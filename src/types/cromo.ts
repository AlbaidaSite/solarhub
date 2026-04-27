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
  rarity: { name: string; icon_path: string } | null;       // icon_path resuelto
  category: { name: string; icon_path: string } | null;     // icon_path resuelto
  artists: Array<{ name: string; url: string | null }>;
}

export interface User {
  id: number;
  name: string;
}
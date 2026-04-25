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

export interface User {
  id: number;
  name: string;
}
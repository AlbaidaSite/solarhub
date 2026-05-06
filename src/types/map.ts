export interface Pin {
  id: number;
  user_id: string;
  sticker_id: number;
  country_code: string;
  state: string | null;
  place: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Sticker {
  id: number;
  name: string;
  icon_path: string;
}

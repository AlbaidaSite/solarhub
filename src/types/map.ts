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

export type MediaType = "PHOTO" | "VIDEO";

export interface MapMedia {
  id: number;
  pin_id: number;
  url: string;
  type: MediaType;
}

export interface PinDetail {
  pin: Pin;
  countryName: string;
  username: string;
  sticker: Sticker | null;
  media: MapMedia[];
}

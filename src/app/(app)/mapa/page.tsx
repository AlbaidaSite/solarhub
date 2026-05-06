import type { Metadata } from "next";
import MapContainer from "./components/MapContainer";
import { getPinsAndStickersAction } from "./actions";

export const metadata: Metadata = { title: "Mapa | SolarHub" };

export default async function MapPage() {
  const { pins, stickers } = await getPinsAndStickersAction();

  return <MapContainer pins={pins} stickers={stickers} />;
}
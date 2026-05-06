"use client";

import dynamic from "next/dynamic";
import MapLoading from "./MapLoading";
import type { Pin, Sticker } from "@/types/map";

const GlobeClient = dynamic(() => import("./GlobeClient"), {
  ssr: false,
  loading: MapLoading,
});

interface MapContainerProps {
  pins: Pin[];
  stickers: Record<number, Sticker>;
}

export default function MapContainer({ pins, stickers }: MapContainerProps) {
  return (
    <div className="w-full h-screen -mt-32">
      <GlobeClient pins={pins} stickers={new Map(Object.entries(stickers).map(([k, v]) => [parseInt(k), v]))} />
    </div>
  );
}

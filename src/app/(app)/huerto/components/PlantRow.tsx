"use client";

import Image from "next/image";
import type { Plant } from "@/types/garden";

interface PlantRowProps {
  plant: Plant;
  onSelect?: (plantId: number) => void;
}

export default function PlantRow({ plant, onSelect }: PlantRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(plant.id)}
      title={plant.name}
      aria-label={plant.name}
      className="relative w-14 h-14 shrink-0"
    >
      <Image src={plant.icon_path} alt={plant.name} fill sizes="56px" className="object-contain" />
    </button>
  );
}

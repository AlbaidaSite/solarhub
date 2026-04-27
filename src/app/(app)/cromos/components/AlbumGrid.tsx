"use client";

import { useState } from "react";
import CromoCard from "./CromoCard";
import CromoModal from "./CromoModal";
import type { CromoDetail } from "@/types/cromo";

interface AlbumGridProps {
  cromos: CromoDetail[];
}

export default function AlbumGrid({ cromos }: AlbumGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selected = selectedIndex !== null ? cromos[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < cromos.length - 1;

  return (
    <>
      <div className="grid justify-center grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 p-4">
        {cromos.map((cromo, i) => (
          <CromoCard
            key={`${cromo.number}-${cromo.variant}`}
            cromo={cromo}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {selected && (
        <CromoModal
          // key fuerza remount al cambiar de cromo: resetea showBack y la transición
          key={selected.id}
          cromo={selected}
          onClose={() => setSelectedIndex(null)}
          onPrev={hasPrev ? () => setSelectedIndex((i) => (i ?? 0) - 1) : undefined}
          onNext={hasNext ? () => setSelectedIndex((i) => (i ?? 0) + 1) : undefined}
        />
      )}
    </>
  );
}

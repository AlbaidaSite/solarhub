"use client";

import { useMemo, useState } from "react";
import AlbumFilters from "./AlbumFilters";
import CromoCard from "./CromoCard";
import CromoModal from "./CromoModal";
import { buildCromoPath } from "../lib/slug";
import { compareCromos } from "../lib/sort";
import type { Category, CromoDetail, Rarity, SortBy } from "@/types/cromo";

interface AlbumGridProps {
  cromos: CromoDetail[];
  categories: Category[];
  rarities: Rarity[];
}

// Quita acentos y pasa a minúsculas — para búsquedas tolerantes a mayúsculas y diacríticos.
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function AlbumGrid({ cromos, categories, rarities }: AlbumGridProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedRarityId, setSelectedRarityId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("number");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const visibleCromos = useMemo(() => {
    const normalizedQuery = normalize(searchQuery.trim());
    const filtered = cromos.filter((c) => {
      if (selectedCategoryId !== null && c.category?.id !== selectedCategoryId) return false;
      if (selectedRarityId !== null && c.rarity?.id !== selectedRarityId) return false;
      if (normalizedQuery && !normalize(c.name).includes(normalizedQuery)) return false;
      return true;
    });

    // Si hay filtro de rareza activo, forzamos rareza > categoría > número
    // (idéntico al orden `rarity_asc`).
    const effectiveSort: SortBy = selectedRarityId !== null ? "rarity_asc" : sortBy;
    return filtered.sort((a, b) => compareCromos(a, b, effectiveSort));
  }, [cromos, selectedCategoryId, selectedRarityId, sortBy, searchQuery]);

  // Resetear índice seleccionado cuando cambian los filtros para que no
  // apunte a un cromo que ya no está en la lista visible.
  const handleCategoryChange = (id: number | null) => {
    setSelectedCategoryId(id);
    setSelectedIndex(null);
  };
  const handleRarityChange = (id: number | null) => {
    setSelectedRarityId(id);
    setSelectedIndex(null);
  };
  const handleSortChange = (sort: SortBy) => {
    setSortBy(sort);
    setSelectedIndex(null);
  };
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(null);
  };

  const selected = selectedIndex !== null ? visibleCromos[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < visibleCromos.length - 1;

  return (
    <>
      <AlbumFilters
        categories={categories}
        rarities={rarities}
        selectedCategoryId={selectedCategoryId}
        selectedRarityId={selectedRarityId}
        onCategoryChange={handleCategoryChange}
        onRarityChange={handleRarityChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        isModalOpen={selected !== null}
      />

      <div className="grid justify-center grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 p-4">
        {visibleCromos.map((cromo, i) => (
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

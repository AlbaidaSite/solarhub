"use client";

import { useMemo, useState } from "react";
import AlbumFilters from "./AlbumFilters";
import CromoCard from "./CromoCard";
import { buildIdSlug } from "../lib/slug";
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

function compareCromos(a: CromoDetail, b: CromoDetail, sortBy: SortBy): number {
  switch (sortBy) {
    case "number": {
      const ao = a.category?.order_number ?? Number.POSITIVE_INFINITY;
      const bo = b.category?.order_number ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (a.number !== b.number) return a.number - b.number;
      return a.variant - b.variant;
    }
    case "rarity_desc": {
      const ar = a.rarity?.id ?? -Infinity;
      const br = b.rarity?.id ?? -Infinity;
      if (ar !== br) return br - ar;
      if (a.number !== b.number) return a.number - b.number;
      return a.variant - b.variant;
    }
    case "rarity_asc": {
      const ar = a.rarity?.id ?? Number.POSITIVE_INFINITY;
      const br = b.rarity?.id ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      if (a.number !== b.number) return a.number - b.number;
      return a.variant - b.variant;
    }
    case "name":
      return a.name.localeCompare(b.name, "es");
  }
}

// Cuando hay un filtro de rareza activo, el orden se fuerza a rareza > categoría > número.
function compareByRarityFirst(a: CromoDetail, b: CromoDetail): number {
  const ar = a.rarity?.id ?? Number.POSITIVE_INFINITY;
  const br = b.rarity?.id ?? Number.POSITIVE_INFINITY;
  if (ar !== br) return ar - br;
  const ao = a.category?.order_number ?? Number.POSITIVE_INFINITY;
  const bo = b.category?.order_number ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  if (a.number !== b.number) return a.number - b.number;
  return a.variant - b.variant;
}

export default function AlbumGrid({ cromos, categories, rarities }: AlbumGridProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedRarityId, setSelectedRarityId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("number");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleCromos = useMemo(() => {
    const normalizedQuery = normalize(searchQuery.trim());
    const filtered = cromos.filter((c) => {
      if (selectedCategoryId !== null && c.category?.id !== selectedCategoryId) return false;
      if (selectedRarityId !== null && c.rarity?.id !== selectedRarityId) return false;
      if (normalizedQuery && !normalize(c.name).includes(normalizedQuery)) return false;
      return true;
    });

    if (selectedRarityId !== null) {
      return filtered.sort(compareByRarityFirst);
    }
    return filtered.sort((a, b) => compareCromos(a, b, sortBy));
  }, [cromos, selectedCategoryId, selectedRarityId, sortBy, searchQuery]);

  return (
    <>
      <AlbumFilters
        categories={categories}
        rarities={rarities}
        selectedCategoryId={selectedCategoryId}
        selectedRarityId={selectedRarityId}
        onCategoryChange={setSelectedCategoryId}
        onRarityChange={setSelectedRarityId}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="grid justify-center grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 p-4">
        {visibleCromos.map((cromo) => (
          <CromoCard
            key={`${cromo.number}-${cromo.variant}`}
            cromo={cromo}
            href={`/cromos/${buildIdSlug(cromo.id, cromo.name)}`}
          />
        ))}
      </div>
    </>
  );
}

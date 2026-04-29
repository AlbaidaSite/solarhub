"use client";

import { useEffect, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import AuroraField from "@/components/ui/AuroraField";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Category, Rarity, SortBy } from "@/types/cromo";
import FilterIconButton from "./FilterIconButton";
import RegisterCromoButton from "./RegisterCromoButton";

interface AlbumFiltersProps {
  categories: Category[];
  rarities: Rarity[];
  selectedCategoryId: number | null;
  selectedRarityId: number | null;
  onCategoryChange: (id: number | null) => void;
  onRarityChange: (id: number | null) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ALL_ICON = getStorageUrl("categories/all.webp");

// Detecta `/cromos/<digits>...` (modal o página completa de un cromo).
// Excluye `/cromos`, `/cromos/registrar` y cualquier subruta no-cromo.
const CROMO_DETAIL_PATH = /^\/cromos\/\d/;

export default function AlbumFilters({
  categories,
  rarities,
  selectedCategoryId,
  selectedRarityId,
  onCategoryChange,
  onRarityChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
}: AlbumFiltersProps) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const isVisible = useScrollDirection(scrollEl);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const isCromoOpen = CROMO_DETAIL_PATH.test(pathname);

  useEffect(() => {
    setScrollEl(document.querySelector("main"));
  }, []);

  const categoryButtons = (
    <>
      <FilterIconButton
        iconUrl={ALL_ICON}
        label="Todas las categorías"
        active={selectedCategoryId === null}
        size="lg"
        onClick={() => onCategoryChange(null)}
      />
      {categories.map((cat) => (
        <FilterIconButton
          key={cat.id}
          iconUrl={cat.icon_path}
          label={cat.name}
          active={selectedCategoryId === cat.id}
          size="lg"
          onClick={() => onCategoryChange(cat.id)}
        />
      ))}
    </>
  );

  const rarityButtons = (
    <>
      <FilterIconButton
        iconUrl={ALL_ICON}
        label="Todas las rarezas"
        active={selectedRarityId === null}
        size="sm"
        onClick={() => onRarityChange(null)}
      />
      {rarities.map((r) => (
        <FilterIconButton
          key={r.id}
          iconUrl={r.icon_path}
          label={r.name}
          active={selectedRarityId === r.id}
          size="sm"
          onClick={() => onRarityChange(r.id)}
        />
      ))}
    </>
  );

  return (
    <>
      {/* ───── Desktop (≥ nav 650px): categorías centradas; debajo: sort | rarezas | búsqueda ───── */}
      <div className="hidden nav:block px-4 pt-2 pb-6">
        <div className="flex flex-wrap justify-center gap-3">
          {categoryButtons}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="w-40 shrink-0">
            <AuroraField
              as="select"
              size="sm"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortBy)}
              aria-label="Ordenar por"
            >
              <option value="number">Ordenar por número</option>
              <option value="rarity_desc">Rareza descendente</option>
              <option value="rarity_asc">Rareza ascendente</option>
              <option value="name">Nombre</option>
            </AuroraField>
          </div>

          <div className="flex flex-wrap justify-center gap-3 flex-1 min-w-0">
            {rarityButtons}
          </div>

          <div className="w-44 shrink-0">
            <AuroraField
              size="sm"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar"
              icon={<Search size={16} strokeWidth={2.5} />}
              iconPosition="left"
            />
          </div>
        </div>
      </div>

      {/* ───── Mobile (< nav 650px): embudo + acceso a "registrar cromo" apilados arriba-izquierda ───── */}
      <div
        className={`nav:hidden fixed top-0 left-0 z-50 pointer-events-none transition-transform duration-300 ${
          isVisible && !isCromoOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex flex-col items-start gap-2 p-6">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="text-white hover:text-gray-300 transition-colors p-2 pointer-events-auto"
            aria-label="Abrir filtros"
          >
            <Filter size={32} />
          </button>

          <RegisterCromoButton className="inline-flex pointer-events-auto" />
        </div>
      </div>

      {/* ───── Mobile overlay con todos los filtros ───── */}
      <div
        className={`nav:hidden fixed inset-0 z-100 ${
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        } transition-opacity duration-300`}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <div className="fixed top-4 left-4 z-20">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="text-red-300/70 hover:text-gray-300 transition-colors p-2 mt-2 mr-2"
            aria-label="Cerrar filtros"
          >
            <X size={32} />
          </button>
        </div>

        <div className="relative z-10 h-full overflow-y-auto px-6 pt-20 pb-10">
          <div className="flex flex-col gap-8 max-w-md mx-auto">
            <div className="flex flex-wrap justify-center gap-3">
              {categoryButtons}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {rarityButtons}
            </div>

            <AuroraField
              as="select"
              size="sm"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortBy)}
              aria-label="Ordenar por"
            >
              <option value="number">Ordenar por número</option>
              <option value="rarity_desc">Rareza descendente</option>
              <option value="rarity_asc">Rareza ascendente</option>
              <option value="name">Nombre</option>
            </AuroraField>

            <AuroraField
              size="sm"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar"
              icon={<Search size={16} strokeWidth={2.5} />}
              iconPosition="left"
            />
          </div>
        </div>
      </div>
    </>
  );
}

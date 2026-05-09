"use client";

import { useEffect, useState } from "react";
import { Eye, EyeClosed, Filter, Search, X } from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Category, Rarity, SortBy } from "@/types/cromo";
import FilterIconButton from "./FilterIconButton";
import RegisterCromoButton from "./RegisterCromoButton";
import IntercambiosButton from "./IntercambiosButton";

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
  isModalOpen: boolean;
  showAll: boolean;
  onShowAllToggle: () => void;
  isSuperuser: boolean;
  showSuperAll: boolean;
  onShowSuperAllToggle: () => void;
}

const ALL_ICON = getStorageUrl("categories/all.webp");

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
  isModalOpen,
  showAll,
  onShowAllToggle,
  isSuperuser,
  showSuperAll,
  onShowSuperAllToggle,
}: AlbumFiltersProps) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const isVisible = useScrollDirection(scrollEl);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
              <option value="rarity_asc">Rareza ascendente</option>
              <option value="rarity_desc">Rareza descendente</option>
              <option value="name_asc">Nombre ascendente</option>
              <option value="name_desc">Nombre descendente</option>
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

      {/* ───── Mobile (< nav 650px): embudo + botones apilados arriba-izquierda ───── */}
      <div
        className={`nav:hidden fixed top-0 left-0 z-50 pointer-events-none transition-transform duration-300 ${
          isVisible && !isModalOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex flex-col items-start gap-1 p-6">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="text-white hover:text-gray-300 transition-colors p-2 pointer-events-auto"
            aria-label="Abrir filtros"
          >
            <Filter size={32} />
          </button>

          <div className="flex items-center">
            {/* Botón eye en móvil */}
            <button
              type="button"
              onClick={onShowAllToggle}
              aria-label={showAll ? "Mostrar solo mis cromos" : "Mostrar todos los cromos"}
              className="text-white hover:text-amber-300 transition-colors p-2 pointer-events-auto cursor-pointer"
            >
              {showAll || showSuperAll ? <EyeClosed size={28} /> : <Eye size={28} />}
            </button>

            {isSuperuser && (
              <button
                type="button"
                onClick={onShowSuperAllToggle}
                aria-label={showSuperAll ? "Desactivar vista de administrador" : "Ver todos los cromos (administrador)"}
                className={`transition-colors p-2 pointer-events-auto cursor-pointer ${
                  showSuperAll ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-400"
                }`}
              >
                {showSuperAll ? <EyeClosed size={28} /> : <Eye size={28} />}
              </button>
            )}

            <RegisterCromoButton className="inline-flex pointer-events-auto" />
            <IntercambiosButton className="inline-flex pointer-events-auto" />
          </div>
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
            className="rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors p-2 mt-2 mr-2"
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
              <option value="rarity_asc">Rareza ascendente</option>
              <option value="rarity_desc">Rareza descendente</option>
              <option value="name_asc">Nombre ascendente</option>
              <option value="name_desc">Nombre descendente</option>
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

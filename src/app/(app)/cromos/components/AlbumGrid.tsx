"use client";

import { useMemo, useState } from "react";
import { Eye, EyeClosed } from "lucide-react";
import AlbumFilters from "./AlbumFilters";
import CromoCard from "./CromoCard";
import CromoModal from "./CromoModal";
import Pagination from "@/components/ui/Pagination";
import { compareCromos } from "../lib/sort";
import type { Category, CromoDetail, Rarity, SortBy } from "@/types/cromo";

const PAGE_SIZE =30;

interface AlbumGridProps {
  cromos: CromoDetail[];
  categories: Category[];
  rarities: Rarity[];
  isSuperuser: boolean;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// En modo dios (showSuperAll) todos los cromos se muestran a color con imagen real.
function toGodModeCromo(c: CromoDetail): CromoDetail {
  return { ...c, ownershipState: "owned", isImageLocked: false };
}

export default function AlbumGrid({ cromos, categories, rarities, isSuperuser }: AlbumGridProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedRarityId, setSelectedRarityId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("number");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  // showSuperAll: solo accesible para superusuarios — muestra todo a color
  const [showSuperAll, setShowSuperAll] = useState(false);
  const [page, setPage] = useState(1);

  const visibleCromos = useMemo(() => {
    const normalizedQuery = normalize(searchQuery.trim());
    const filtered = cromos.filter((c) => {
      if (!showAll && !showSuperAll && c.ownershipState === "never_owned") return false;
      if (selectedCategoryId !== null && c.category?.id !== selectedCategoryId) return false;
      if (selectedRarityId !== null && c.rarity?.id !== selectedRarityId) return false;
      if (normalizedQuery && !normalize(c.name).includes(normalizedQuery)) return false;
      return true;
    });

    const effectiveSort: SortBy = selectedRarityId !== null ? "rarity_asc" : sortBy;
    return filtered.sort((a, b) => compareCromos(a, b, effectiveSort));
  }, [cromos, selectedCategoryId, selectedRarityId, sortBy, searchQuery, showAll, showSuperAll]);

  // Cualquier cambio de filtro reinicia la paginación a la primera página.
  const handleCategoryChange = (id: number | null) => { setSelectedCategoryId(id); setSelectedIndex(null); setPage(1); };
  const handleRarityChange   = (id: number | null) => { setSelectedRarityId(id);   setSelectedIndex(null); setPage(1); };
  const handleSortChange     = (sort: SortBy)       => { setSortBy(sort);           setSelectedIndex(null); setPage(1); };
  const handleSearchChange   = (query: string)      => { setSearchQuery(query);     setSelectedIndex(null); setPage(1); };
  const handleShowAllToggle  = ()                   => { setShowAll((s) => !s);     setSelectedIndex(null); setPage(1); };
  const handleSuperAllToggle = ()                   => { setShowSuperAll((s) => !s); setSelectedIndex(null); setPage(1); };

  // Paginación: 30 cromos por página. currentPage se acota por si el filtrado
  // reduce el total por debajo de la página activa.
  const totalPages = Math.max(1, Math.ceil(visibleCromos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedCromos = visibleCromos.slice(pageStart, pageStart + PAGE_SIZE);

  const handlePageChange = (p: number) => {
    setPage(p);
    setSelectedIndex(null);
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selected = selectedIndex !== null ? visibleCromos[selectedIndex] : null;
  const hasPrev  = selectedIndex !== null && selectedIndex > 0;
  const hasNext  = selectedIndex !== null && selectedIndex < visibleCromos.length - 1;

  // Aplica la transformación dios-modo al cromo antes de renderizarlo
  const display = (c: CromoDetail) => showSuperAll ? toGodModeCromo(c) : c;

  return (
    <>
      {/* Botones izquierda desktop: simétricos a IntercambiosButton top-right en page.tsx */}
      <div className="hidden nav:flex flex-col items-center absolute top-0 left-0 z-10">
        <button
          type="button"
          onClick={handleShowAllToggle}
          aria-label={showAll ? "Mostrar solo mis cromos" : "Mostrar todos los cromos"}
          className="text-white hover:text-amber-300 transition-colors p-2 cursor-pointer"
        >
          {showAll || showSuperAll ? <EyeClosed size={32} /> : <Eye size={32} />}
        </button>

        {isSuperuser && (
          <button
            type="button"
            onClick={handleSuperAllToggle}
            aria-label={showSuperAll ? "Desactivar vista de administrador" : "Ver todos los cromos (administrador)"}
            className={`transition-colors -mt-2 cursor-pointer ${
              showSuperAll ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-400"
            }`}
          >
            {showSuperAll ? <EyeClosed size={32} /> : <Eye size={32} />}
          </button>
        )}
      </div>

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
        showAll={showAll}
        onShowAllToggle={handleShowAllToggle}
        isSuperuser={isSuperuser}
        showSuperAll={showSuperAll}
        onShowSuperAllToggle={handleSuperAllToggle}
      />

      {visibleCromos.length === 0 && !showAll && !showSuperAll ? (
        <p className="text-chip text-center text-zinc-200 px-6 py-4 my-16 max-w-md mx-auto leading-relaxed">
          Ahora mismo no tienes ningún cromo con estas características, registra alguno pulsando el botón con círculos de arriba a la derecha o mira cómo conseguirlos pulsando el botón{" "}
          <Eye size={14} className="inline-block align-middle" />{" "}
          de arriba a la izquierda.
        </p>
      ) : (
        <>
          <div className="grid justify-center grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 p-4">
            {pagedCromos.map((cromo, i) => (
              <CromoCard
                key={`${cromo.number}-${cromo.variant}`}
                cromo={display(cromo)}
                onClick={() => setSelectedIndex(pageStart + i)}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {selected && (
        <CromoModal
          key={selected.id}
          cromo={display(selected)}
          onClose={() => setSelectedIndex(null)}
          onPrev={hasPrev ? () => setSelectedIndex((i) => (i ?? 0) - 1) : undefined}
          onNext={hasNext ? () => setSelectedIndex((i) => (i ?? 0) + 1) : undefined}
        />
      )}
    </>
  );
}

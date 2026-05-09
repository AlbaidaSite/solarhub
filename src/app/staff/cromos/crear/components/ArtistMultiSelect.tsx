"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface ArtistOption {
  id: number;
  name: string;
}

interface ArtistMultiSelectProps {
  artists: ArtistOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

// Quita acentos y pasa a minúsculas para búsquedas tolerantes.
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function ArtistMultiSelect({
  artists,
  selectedIds,
  onChange,
}: ArtistMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera del componente
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedArtists = useMemo(
    () => artists.filter((a) => selectedSet.has(a.id)),
    [artists, selectedSet],
  );

  const filtered = useMemo(() => {
    const nq = normalize(query.trim());
    return artists.filter((a) => !nq || normalize(a.name).includes(nq));
  }, [artists, query]);

  const toggle = (id: number) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chips de seleccionados */}
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedArtists.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-300/40 text-amber-200 text-xs"
            >
              {a.name}
              <button
                type="button"
                onClick={() => toggle(a.id)}
                aria-label={`Quitar ${a.name}`}
                className="rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input de búsqueda */}
      <div className="relative">
        <Search
          size={16}
          strokeWidth={2.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar artista…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg bg-zinc-900 border border-white/15 shadow-lg scrollbar-clean">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-white/40">Sin resultados</p>
          ) : (
            filtered.map((a) => {
              const checked = selectedSet.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                    checked
                      ? "bg-amber-300/15 text-amber-200"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <span>{a.name}</span>
                  {checked && <span className="text-xs">✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

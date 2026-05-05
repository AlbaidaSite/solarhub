"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { getThumbUrl } from "@/lib/supabase/storage";
import {
  addUniqueToOfferAction,
  getUserOwnedCromosForTradeAction,
  type OwnedCromoForTrade,
} from "../actions";

interface AddCromoToTradeModalProps {
  tradeOfferId: number;
  onClose: () => void;
  onAdded: (uniqueId: number, cromoName: string, copyNumber: number, thumbUrl: string | null) => void;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function AddCromoToTradeModal({
  tradeOfferId,
  onClose,
  onAdded,
}: AddCromoToTradeModalProps) {
  const [cromos, setCromos]     = useState<OwnedCromoForTrade[] | null>(null);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<{ cromo: OwnedCromoForTrade; uniqueId: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getUserOwnedCromosForTradeAction(tradeOfferId).then(setCromos);
  }, [tradeOfferId]);

  const filtered = useMemo(() => {
    if (!cromos) return [];
    const nq = normalize(search.trim());
    return nq ? cromos.filter((c) => normalize(c.cromoName).includes(nq)) : cromos;
  }, [cromos, search]);

  const handleAdd = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await addUniqueToOfferAction(tradeOfferId, selected.uniqueId);
      if (result.ok) {
        const u = selected.cromo.uniques.find((u) => u.uniqueId === selected.uniqueId)!;
        const thumb = selected.cromo.thumbPath ? getThumbUrl(selected.cromo.thumbPath) : null;
        onAdded(selected.uniqueId, selected.cromo.cromoName, u.copyNumber, thumb);
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl p-5 max-w-sm w-full mx-4 flex flex-col gap-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Añadir cromo</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative flex items-center gap-2 rounded-lg bg-white/5 border border-white/15 px-3 py-2 focus-within:border-amber-300 transition-colors">
          <Search size={14} className="text-white/50 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cromo…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/40"
          />
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto scrollbar-clean divide-y divide-white/10 -mx-5 px-5">
          {cromos === null && (
            <p className="py-4 text-center text-white/40 text-sm">Cargando…</p>
          )}
          {cromos !== null && filtered.length === 0 && (
            <p className="py-4 text-center text-white/40 text-sm">
              {cromos.length === 0 ? "No tienes cromos disponibles para añadir." : "Sin resultados."}
            </p>
          )}
          {filtered.map((c) => (
            <div key={c.cromoId} className="py-2">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="relative w-8 h-8 shrink-0 rounded overflow-hidden bg-zinc-800">
                  <Image
                    src={c.thumbPath ? getThumbUrl(c.thumbPath) : "/cromos/locked.webp"}
                    alt={c.cromoName}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <p className="text-white text-sm font-medium">{c.cromoName}</p>
              </div>

              {/* Selector de copia */}
              <div className="flex flex-wrap gap-1.5 pl-11">
                {c.uniques.map((u) => {
                  const isSelected = selected?.cromo.cromoId === c.cromoId && selected.uniqueId === u.uniqueId;
                  return (
                    <button
                      key={u.uniqueId}
                      type="button"
                      onClick={() => setSelected({ cromo: c, uniqueId: u.uniqueId })}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-amber-300/20 border-amber-300/60 text-amber-200"
                          : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Copia #{u.copyNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selected || isPending}
          className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold transition-colors cursor-pointer"
        >
          {isPending ? "Añadiendo…" : "Añadir a mi oferta"}
        </button>
      </div>
    </div>
  );
}

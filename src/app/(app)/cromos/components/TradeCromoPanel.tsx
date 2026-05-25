"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  addUniqueToMyTradeOfferAction,
  getTradeContextAction,
  startTradeAction,
  type TradeContext,
} from "@/app/(app)/intercambios/actions";

interface TradeCromoPanelProps {
  cromoName: string;
  // Uniques pre-seleccionados desde la sección "Copias" del CromoModal.
  // El panel los añade todos al trade que el usuario elija.
  selectedUniqueIds: number[];
  onClose: () => void;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function TradeCromoPanel({
  cromoName,
  selectedUniqueIds,
  onClose,
}: TradeCromoPanelProps) {
  const router = useRouter();
  const [ctx, setCtx] = useState<TradeContext | null>(null);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar contexto (trades abiertos + perfiles) al montar.
  // También hacemos scroll a 0 en main para que el navbar sea visible
  // (antes se resetaba en CromoModal, pero lo quitamos para preservar
  // el scroll del álbum; aquí sí lo necesitamos para que el navbar aparezca).
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    getTradeContextAction().then(setCtx);
  }, []);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!dropdownOpen) return;
    const fn = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [dropdownOpen]);

  const filteredProfiles = useMemo(() => {
    if (!ctx) return [];
    // Excluir usuarios con los que ya hay un intercambio abierto: para esos
    // se usa la sección "Añadir a intercambio existente" (no se permite
    // crear un segundo trade duplicado).
    const usersWithOpenTrade = new Set(ctx.openTrades.map((t) => t.otherUserId));
    const nq = normalize(search.trim());
    return ctx.profiles
      .filter((p) => !usersWithOpenTrade.has(p.id))
      .filter((p) => !nq || normalize(p.username).includes(nq));
  }, [ctx, search]);

  // Añade TODOS los uniques seleccionados al trade. Si alguna inserción falla
  // (ej. el unique ya está en otro trade activo, validación DB), se reporta y
  // se aborta el resto. Los que ya entraron quedan dentro: el usuario verá
  // el estado real al aterrizar en el detalle del trade.
  const addAllToTrade = async (tradeId: number): Promise<string | null> => {
    for (const uid of selectedUniqueIds) {
      const result = await addUniqueToMyTradeOfferAction(tradeId, uid);
      if (!result.ok) return result.error;
    }
    return null;
  };

  const handleAddToExisting = (tradeId: number) => {
    if (selectedUniqueIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const err = await addAllToTrade(tradeId);
      if (err) { setError(err); return; }
      router.push(`/intercambios/${tradeId}`);
    });
  };

  const handleStartNew = (otherUserId: string) => {
    if (selectedUniqueIds.length === 0) return;
    setError(null);
    setDropdownOpen(false);
    setSearch("");
    startTransition(async () => {
      const startResult = await startTradeAction(otherUserId);
      if (!startResult.ok) { setError(startResult.error); return; }
      const tradeId = startResult.tradeId!;
      const err = await addAllToTrade(tradeId);
      if (err) { setError(err); return; }
      router.push(`/intercambios/${tradeId}`);
    });
  };

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto scrollbar-clean mt-19">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-white leading-tight">
          Intercambiar:<br />
          <span className="text-amber-300">{cromoName}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
        >
          <X size={28} />
        </button>
      </div>

      {/* Resumen de qué se va a intercambiar (selección hecha en el modal). */}
      <p className="text-xs text-white/60">
        {selectedUniqueIds.length === 1
          ? "1 copia seleccionada"
          : `${selectedUniqueIds.length} copias seleccionadas`} para intercambiar.
      </p>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {ctx === null ? (
        <p className="text-white/40 text-sm">Cargando…</p>
      ) : (
        <>
          {/* ── Añadir a intercambio existente ────────── */}
          {ctx.openTrades.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">
                Añadir a intercambio existente
              </p>
              <div className="flex flex-col gap-1.5">
                {ctx.openTrades.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAddToExisting(t.id)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span>Con <span className="font-semibold text-amber-300">{t.otherUsername}</span></span>
                    <span className="text-xs text-white/40">Añadir →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Iniciar nuevo intercambio ──────────────── */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">
              Iniciar nuevo intercambio
            </p>
            <div ref={dropdownRef} className="relative">
              <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/15 px-3 py-2 focus-within:border-amber-300 transition-colors">
                <Search size={14} className="text-white/50 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Buscar usuario…"
                  className="flex-1 bg-transparent outline-none text-xs text-white placeholder-white/40"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>

              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-44 overflow-y-auto rounded-lg bg-zinc-900 border border-white/15 shadow-lg scrollbar-clean">
                  {filteredProfiles.length === 0 && (
                    <p className="px-3 py-2 text-xs text-white/40">Sin resultados</p>
                  )}
                  {filteredProfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStartNew(p.id)}
                      className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {p.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

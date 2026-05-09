"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cancelTradeAction, startTradeAction } from "../actions";

interface Trade {
  id: number;
  createdAt: string;
  otherUser: { id: string; username: string } | null;
}

interface Profile {
  id: string;
  username: string;
}

interface DeleteState { id: number; step: "confirm1" | "confirm2" }

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function TradeListClient({
  trades: initial,
  profiles,
  currentUserId: _currentUserId,
}: {
  trades: Trade[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [trades, setTrades] = useState(initial);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isStarting, startStarting] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);

  // Dropdown de inicio
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const filteredProfiles = useMemo(() => {
    // Excluir usuarios con los que ya tengo un intercambio abierto: si quiero
    // intercambiar con ellos, debo entrar al trade existente. Evita duplicados.
    const usersWithOpenTrade = new Set(
      trades.map((t) => t.otherUser?.id).filter((id): id is string => Boolean(id)),
    );
    const nq = normalize(search.trim());
    return profiles
      .filter((p) => !usersWithOpenTrade.has(p.id))
      .filter((p) => !nq || normalize(p.username).includes(nq));
  }, [profiles, trades, search]);

  const handleStartTrade = (userId: string) => {
    setStartError(null);
    setDropdownOpen(false);
    setSearch("");
    startStarting(async () => {
      const result = await startTradeAction(userId);
      if (result.ok && result.tradeId) {
        router.push(`/intercambios/${result.tradeId}`);
      } else if (!result.ok) {
        setStartError(result.error);
      }
    });
  };

  const handleConfirm2 = () => {
    if (!deleteState) return;
    const { id } = deleteState;
    startDelete(async () => {
      const result = await cancelTradeAction(id);
      if (result.ok) {
        setTrades((prev) => prev.filter((t) => t.id !== id));
        setDeleteState(null);
        setDeleteError(null);
      } else {
        setDeleteError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Iniciar intercambio ───────────────────────────────── */}
      <div ref={dropdownRef} className="relative">
        <div className="relative flex items-center gap-2 rounded-xl bg-white/5 border border-white/15 px-3 py-2 focus-within:border-amber-300 transition-colors">
          <Search size={16} className="text-white/50 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Iniciar intercambio con…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-zinc-900 border border-white/15 shadow-lg scrollbar-clean">
            {isStarting && (
              <p className="px-3 py-2 text-sm text-white/50">Creando intercambio…</p>
            )}
            {!isStarting && filteredProfiles.length === 0 && (
              <p className="px-3 py-2 text-sm text-white/40">Sin resultados</p>
            )}
            {!isStarting && filteredProfiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleStartTrade(p.id)}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
              >
                {p.username}
              </button>
            ))}
          </div>
        )}

        {startError && <p className="mt-1 text-red-400 text-xs">{startError}</p>}
      </div>

      {/* ── Lista de intercambios ─────────────────────────────── */}
      {trades.length === 0 ? (
        <p className="text-center text-white/40 py-8">No tienes intercambios abiertos.</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/10 rounded-xl border border-white/15 overflow-hidden">
          {trades.map((t) => (
            <div
              key={t.id}
              className="flex items-center bg-black hover:bg-zinc-900 transition-colors"
            >
              {/* Zona clicable que lleva al detalle */}
              <button
                type="button"
                onClick={() => router.push(`/intercambios/${t.id}`)}
                className="flex-1 text-left px-4 py-3 cursor-pointer"
              >
                <span className="text-white text-sm">
                  Intercambio pendiente con:{" "}
                  <span className="font-semibold text-amber-300">
                    {t.otherUser?.username ?? "Usuario desconocido"}
                  </span>
                </span>
              </button>

              {/* Cancelar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError(null);
                  setDeleteState({ id: t.id, step: "confirm1" });
                }}
                className="shrink-0 mr-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors cursor-pointer"
              >
                Cancelar intercambio
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal doble confirmación ─────────────────────────── */}
      {deleteState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !isDeleting && setDeleteState(null)}
        >
          <div
            className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteState.step === "confirm1" ? (
              <>
                <p className="text-white font-semibold text-center">
                  ¿Cancelar este intercambio?
                </p>
                {/* Rojo a la izquierda en paso 1 */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteState((s) => s ? { ...s, step: "confirm2" } : null)}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Sí, cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteState(null)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
                  >
                    No
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-center">
                  Esta acción no se puede deshacer. ¿Confirmar cancelación?
                </p>
                {/* Rojo a la derecha en paso 2 */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteState(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm2}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? "Cancelando…" : "Confirmar"}
                  </button>
                </div>
                {deleteError && (
                  <p className="text-red-400 text-sm text-center">{deleteError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

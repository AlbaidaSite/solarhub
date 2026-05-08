"use client";

import { useState, useTransition } from "react";
import { Mail, Check, X, CheckCircle, XCircle } from "lucide-react";
import { approveRequestAction, denyRequestAction } from "../actions";

export interface PendingRow {
  request_id: number;
  user_id: string;
  message: string | null;
  request_date: string;
  username: string;
  name: string;
  email: string;
}

export interface DecidedRow {
  request_id: number;
  user_id: string;
  is_approved: boolean;
  request_date: string;
  username: string;
  name: string;
  email: string;
  message: string | null;
}

// ---------------------------------------------------------------------------
// Message pop-up (shared)
// ---------------------------------------------------------------------------

function MessagePopup({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">
          Mensaje adjunto
        </p>
        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="self-end text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending requests table
// ---------------------------------------------------------------------------

export function PendingRequestsTable({ rows: initial }: { rows: PendingRow[] }) {
  const [rows, setRows] = useState(initial);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const remove = (id: number) => setRows((prev) => prev.filter((r) => r.request_id !== id));

  const handleApprove = (id: number) => {
    setLoadingId(id);
    startTransition(async () => {
      const res = await approveRequestAction(id);
      if (res.ok) remove(id);
      setLoadingId(null);
    });
  };

  const handleDeny = (id: number) => {
    setLoadingId(id);
    startTransition(async () => {
      const res = await denyRequestAction(id);
      if (res.ok) remove(id);
      setLoadingId(null);
    });
  };

  return (
    <>
      <div className="rounded-xl border border-white/15 overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead className="bg-white/10 text-white/60 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-center w-12">Msg</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => {
              const busy = isPending && loadingId === row.request_id;
              return (
                <tr key={row.request_id} className="bg-black hover:bg-zinc-900 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-white/70">@{row.username}</td>
                  <td className="px-4 py-3 text-white/70">{row.email}</td>
                  <td className="px-4 py-3 text-center">
                    {row.message ? (
                      <button
                        type="button"
                        onClick={() => setActiveMessage(row.message)}
                        title="Ver mensaje"
                        className="inline-flex items-center justify-center p-1 rounded text-amber-300 hover:bg-amber-300/10 transition-colors cursor-pointer"
                      >
                        <Mail size={15} strokeWidth={2} />
                      </button>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Aprobar"
                        disabled={busy}
                        onClick={() => handleApprove(row.request_id)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        title="Denegar"
                        disabled={busy}
                        onClick={() => handleDeny(row.request_id)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-white/40">No hay solicitudes pendientes.</p>
        )}
      </div>

      {activeMessage && (
        <MessagePopup message={activeMessage} onClose={() => setActiveMessage(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Decided requests table (read-only)
// ---------------------------------------------------------------------------

export function DecidedRequestsTable({ rows }: { rows: DecidedRow[] }) {
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-white/15 overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead className="bg-white/10 text-white/60 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-center w-12">Msg</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <tr key={row.request_id} className="bg-black hover:bg-zinc-900 transition-colors">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-white/70">@{row.username}</td>
                <td className="px-4 py-3 text-white/70">{row.email}</td>
                <td className="px-4 py-3 text-center">
                  {row.message ? (
                    <button
                      type="button"
                      onClick={() => setActiveMessage(row.message)}
                      title="Ver mensaje"
                      className="inline-flex items-center justify-center p-1 rounded text-amber-300 hover:bg-amber-300/10 transition-colors cursor-pointer"
                    >
                      <Mail size={15} strokeWidth={2} />
                    </button>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    {row.is_approved ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle size={14} /> Aprobada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                        <XCircle size={14} /> Denegada
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeMessage && (
        <MessagePopup message={activeMessage} onClose={() => setActiveMessage(null)} />
      )}
    </>
  );
}

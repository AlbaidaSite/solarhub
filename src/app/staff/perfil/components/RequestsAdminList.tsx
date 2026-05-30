"use client";

import { useState, useTransition } from "react";
import { Mail, Check, X, CheckCircle, XCircle } from "lucide-react";
import AdminTable, { type ColumnDef } from "../../components/AdminTable";
import { RowActions } from "../../components/RowActions";
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

// ─── Mensaje adjunto (popup) ────────────────────────────────────────────────

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
        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
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

// Botón compartido para abrir el mensaje desde una fila. Devuelve "—" si no
// hay mensaje, replicando el comportamiento original.
function MessageButton({
  message,
  onOpen,
}: {
  message: string | null;
  onOpen: (msg: string) => void;
}) {
  if (!message) return <span className="text-white/20">—</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      title="Ver mensaje"
      className="inline-flex items-center justify-center p-1 rounded text-amber-300 hover:bg-amber-300/10 transition-colors cursor-pointer"
    >
      <Mail size={15} strokeWidth={2} />
    </button>
  );
}

// ─── Tabla de solicitudes pendientes ────────────────────────────────────────

export function PendingRequestsTable({
  rows: initial,
}: {
  rows: PendingRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const remove = (id: number) =>
    setRows((prev) => prev.filter((r) => r.request_id !== id));

  const decide = (
    id: number,
    fn: typeof approveRequestAction | typeof denyRequestAction,
  ) => {
    setLoadingId(id);
    startTransition(async () => {
      const res = await fn(id);
      if (res.ok) remove(id);
      setLoadingId(null);
    });
  };

  const columns: ColumnDef<PendingRow>[] = [
    { header: "Nombre", cell: (r) => r.name },
    {
      header: "Usuario",
      cell: (r) => <span className="text-white/70">@{r.username}</span>,
    },
    {
      header: "Correo",
      cell: (r) => <span className="text-white/70">{r.email}</span>,
    },
    {
      header: "Msg",
      align: "center",
      className: "w-12",
      cell: (r) => (
        <MessageButton message={r.message} onOpen={setActiveMessage} />
      ),
    },
  ];

  return (
    <>
      <AdminTable<PendingRow>
        rows={rows}
        getRowKey={(r) => r.request_id}
        columns={columns}
        rowClassName={() => "bg-black hover:bg-zinc-900"}
        rowActions={(row) => {
          const busy = isPending && loadingId === row.request_id;
          return (
            <RowActions>
              <button
                type="button"
                title="Aprobar"
                disabled={busy}
                onClick={() => decide(row.request_id, approveRequestAction)}
                className="p-1.5 rounded-lg text-white/50 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Check size={16} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                title="Denegar"
                disabled={busy}
                onClick={() => decide(row.request_id, denyRequestAction)}
                className="p-1.5 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </RowActions>
          );
        }}
        emptyMessage="No hay solicitudes pendientes."
      />

      {activeMessage && (
        <MessagePopup
          message={activeMessage}
          onClose={() => setActiveMessage(null)}
        />
      )}
    </>
  );
}

// ─── Tabla de solicitudes ya decididas (read-only) ──────────────────────────

export function DecidedRequestsTable({ rows }: { rows: DecidedRow[] }) {
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const columns: ColumnDef<DecidedRow>[] = [
    { header: "Nombre", cell: (r) => r.name },
    {
      header: "Usuario",
      cell: (r) => <span className="text-white/70">@{r.username}</span>,
    },
    {
      header: "Correo",
      cell: (r) => <span className="text-white/70">{r.email}</span>,
    },
    {
      header: "Msg",
      align: "center",
      className: "w-12",
      cell: (r) => (
        <MessageButton message={r.message} onOpen={setActiveMessage} />
      ),
    },
    {
      header: "Estado",
      align: "center",
      cell: (r) =>
        r.is_approved ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <CheckCircle size={14} /> Aprobada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-semibold">
            <XCircle size={14} /> Denegada
          </span>
        ),
    },
  ];

  return (
    <>
      <AdminTable<DecidedRow>
        rows={rows}
        getRowKey={(r) => r.request_id}
        columns={columns}
        rowClassName={() => "bg-black hover:bg-zinc-900"}
        emptyMessage="No hay solicitudes."
      />

      {activeMessage && (
        <MessagePopup
          message={activeMessage}
          onClose={() => setActiveMessage(null)}
        />
      )}
    </>
  );
}

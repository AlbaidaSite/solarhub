"use client";

import { useState, useTransition } from "react";
import { IdCard, Power, PowerOff, Shield, Leaf, Sun } from "lucide-react";
import {
  updateUserCredentialsAction,
  setUserActiveAction,
  type CredentialFlags,
} from "../actions";

export interface UserRow {
  user_id: string;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_loukou: boolean;
  is_garden_manager: boolean;
}

// ─── Filters ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "inactive";

function applyFilters(
  rows: UserRow[],
  status: StatusFilter,
  loukou: boolean,
  garden: boolean,
): UserRow[] {
  return rows.filter((r) => {
    if (status === "active" && !r.is_active) return false;
    if (status === "inactive" && r.is_active) return false;
    if (loukou && !r.is_loukou) return false;
    if (garden && !r.is_garden_manager) return false;
    return true;
  });
}

// ─── Credentials popup ───────────────────────────────────────────────────────

function CredentialsPopup({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: (userId: string, flags: CredentialFlags) => void;
}) {
  const [flags, setFlags] = useState<CredentialFlags>({
    is_staff: user.is_staff,
    is_loukou: user.is_loukou,
    is_garden_manager: user.is_garden_manager,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: keyof CredentialFlags) =>
    setFlags((f) => ({ ...f, [key]: !f[key] }));

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateUserCredentialsAction(user.user_id, flags);
      if (res.ok) {
        onSaved(user.user_id, flags);
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-xs w-full mx-4 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-white font-semibold">{user.name}</p>
          <p className="text-white/50 text-xs">@{user.username}</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* is_superuser — read-only badge */}
          {user.is_superuser && (
            <div className="flex items-center gap-3 opacity-50 cursor-not-allowed select-none">
              <Shield size={16} className="text-amber-300 shrink-0" />
              <span className="text-sm text-white flex-1">Superusuario</span>
              <span className="text-xs text-amber-300 font-semibold">Solo Supabase</span>
            </div>
          )}

          <CredentialToggle
            icon={<Shield size={16} className="text-sky-400 shrink-0" />}
            label="Staff"
            checked={flags.is_staff}
            onChange={() => toggle("is_staff")}
          />
          <CredentialToggle
            icon={<Sun size={16} className="text-orange-300 shrink-0" />}
            label="Loukou"
            checked={flags.is_loukou}
            onChange={() => toggle("is_loukou")}
          />
          <CredentialToggle
            icon={<Leaf size={16} className="text-emerald-400 shrink-0" />}
            label="Admin Huerto"
            checked={flags.is_garden_manager}
            onChange={() => toggle("is_garden_manager")}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-zinc-900 font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      {icon}
      <span className="text-sm text-white flex-1">{label}</span>
      <div
        role="checkbox"
        aria-checked={checked}
        onClick={onChange}
        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
          checked ? "bg-amber-500" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </label>
  );
}

// ─── Power popup (activate / deactivate) ─────────────────────────────────────

type PowerStep = "confirm1" | "confirm2";

function PowerPopup({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: (userId: string, isActive: boolean) => void;
}) {
  const activating = !user.is_active;
  const [step, setStep] = useState<PowerStep>("confirm1");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await setUserActiveAction(user.user_id, activating);
      if (res.ok) {
        onDone(user.user_id, activating);
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  const actionColor = activating
    ? "bg-emerald-600 hover:bg-emerald-500"
    : "bg-red-600 hover:bg-red-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "confirm1" ? (
          <>
            <p className="text-white font-semibold text-center">
              {activating
                ? `¿Reactivar la cuenta de @${user.username}?`
                : `¿Desactivar la cuenta de @${user.username}?`}
            </p>
            <p className="text-white/60 text-sm text-center leading-relaxed">
              {activating
                ? "El usuario recuperará el acceso a la plataforma."
                : "El usuario perderá el acceso a la plataforma hasta que se reactive."}
            </p>
            <div className="flex gap-3">
              {/* Step 1: action button LEFT */}
              <button
                type="button"
                onClick={() => setStep("confirm2")}
                className={`flex-1 px-4 py-2 rounded-xl text-white font-semibold transition-colors cursor-pointer ${actionColor}`}
              >
                {activating ? "Reactivar" : "Desactivar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-center">
              {activating ? "¿Confirmar reactivación?" : "¿Confirmar desactivación?"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              {/* Step 2: action button RIGHT */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className={`flex-1 px-4 py-2 rounded-xl text-white font-semibold transition-colors cursor-pointer disabled:opacity-50 ${actionColor}`}
              >
                {isPending ? "Guardando…" : "Confirmar"}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
        active
          ? "bg-amber-500 border-amber-500 text-zinc-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UsersAdminList({
  rows: initial,
  isSuperuser,
}: {
  rows: UserRow[];
  isSuperuser: boolean;
}) {
  const [rows, setRows] = useState<UserRow[]>(initial);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterLoukou, setFilterLoukou] = useState(false);
  const [filterGarden, setFilterGarden] = useState(false);

  const [credUser, setCredUser] = useState<UserRow | null>(null);
  const [powerUser, setPowerUser] = useState<UserRow | null>(null);

  const updateRow = (userId: string, patch: Partial<UserRow>) =>
    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, ...patch } : r)));

  const handleCredSaved = (userId: string, flags: CredentialFlags) =>
    updateRow(userId, flags);

  const handlePowerDone = (userId: string, isActive: boolean) =>
    updateRow(userId, { is_active: isActive });

  const toggleStatus = (s: StatusFilter) =>
    setStatusFilter((prev) => (prev === s ? "all" : s));

  const visible = applyFilters(rows, statusFilter, filterLoukou, filterGarden);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Activos"
          active={statusFilter === "active"}
          onClick={() => toggleStatus("active")}
        />
        <FilterChip
          label="Inactivos"
          active={statusFilter === "inactive"}
          onClick={() => toggleStatus("inactive")}
        />
        <FilterChip
          label="Loukou"
          active={filterLoukou}
          onClick={() => setFilterLoukou((v) => !v)}
        />
        <FilterChip
          label="Admin Huerto"
          active={filterGarden}
          onClick={() => setFilterGarden((v) => !v)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/15 overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead className="bg-white/10 text-white/60 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visible.map((row) => (
              <tr
                key={row.user_id}
                className={`transition-colors ${
                  row.is_active ? "bg-black hover:bg-zinc-900" : "bg-zinc-950 hover:bg-zinc-900 opacity-60"
                }`}
              >
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-white/70">@{row.username}</td>
                <td className="px-4 py-3 text-white/70">{row.email}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {isSuperuser && (
                      <button
                        type="button"
                        title="Credenciales"
                        onClick={() => setCredUser(row)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <IdCard size={16} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      type="button"
                      title={row.is_active ? "Desactivar cuenta" : "Reactivar cuenta"}
                      onClick={() => setPowerUser(row)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        row.is_active
                          ? "text-white/50 hover:text-red-400 hover:bg-red-400/10"
                          : "text-white/50 hover:text-emerald-400 hover:bg-emerald-400/10"
                      }`}
                    >
                      {row.is_active ? (
                        <PowerOff size={16} strokeWidth={2} />
                      ) : (
                        <Power size={16} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-8 text-center text-white/40">
            No hay usuarios con los filtros seleccionados.
          </p>
        )}
      </div>

      {credUser && (
        <CredentialsPopup
          user={credUser}
          onClose={() => setCredUser(null)}
          onSaved={handleCredSaved}
        />
      )}
      {powerUser && (
        <PowerPopup
          user={powerUser}
          onClose={() => setPowerUser(null)}
          onDone={handlePowerDone}
        />
      )}
    </>
  );
}

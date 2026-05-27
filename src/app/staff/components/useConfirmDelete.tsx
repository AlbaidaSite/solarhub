"use client";

import { useState, useTransition, type ReactNode } from "react";
import ConfirmDialog from "./ConfirmDialog";

type DeleteResult = { ok: true } | { ok: false; error: string };

interface UseConfirmDeleteOpts<Id extends number | string> {
  // Texto inyectado en "¿Estás seguro de que quieres eliminar este {itemLabel}?".
  itemLabel: string;
  action: (id: Id) => Promise<DeleteResult>;
  onSuccess: (id: Id) => void;
}

interface UseConfirmDeleteReturn<Id extends number | string> {
  openDelete: (id: Id) => void;
  dialog: ReactNode;
}

// Hook que encapsula la máquina de estado del borrado en 2 pasos, idéntica
// entre las listas admin (cromos, artistas, stickers…). El consumidor solo
// invoca `openDelete(id)` y renderiza `dialog` al final de su JSX.
export function useConfirmDelete<Id extends number | string>({
  itemLabel,
  action,
  onSuccess,
}: UseConfirmDeleteOpts<Id>): UseConfirmDeleteReturn<Id> {
  const [state, setState] = useState<{
    id: Id;
    step: "confirm1" | "confirm2";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openDelete = (id: Id) => {
    setError(null);
    setState({ id, step: "confirm1" });
  };

  const handleAdvance = () =>
    setState((s) => (s ? { ...s, step: "confirm2" } : null));

  const handleConfirm = () => {
    if (!state) return;
    const { id } = state;
    startTransition(async () => {
      const result = await action(id);
      if (result.ok) {
        onSuccess(id);
        setState(null);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  };

  const dialog = state ? (
    <ConfirmDialog
      step={state.step}
      step1Message={`¿Estás seguro de que quieres eliminar este ${itemLabel}?`}
      step2Message="Esta acción no se puede deshacer. ¿Confirmar eliminación?"
      confirmLabel="Sí, estoy seguro"
      pendingLabel="Eliminando…"
      isPending={isPending}
      error={error}
      onAdvance={handleAdvance}
      onConfirm={handleConfirm}
      onCancel={() => setState(null)}
    />
  ) : null;

  return { openDelete, dialog };
}

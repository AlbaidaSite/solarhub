"use client";

// Diálogo modal genérico de confirmación en 2 pasos. La posición de los botones
// se invierte entre el paso 1 y el paso 2 para evitar confirmaciones por
// doble-clic accidental sobre el mismo punto.
//
// El componente es controlado: el padre (típicamente un hook) gestiona el
// estado de paso, pending y errores, y le pasa los handlers.

interface ConfirmDialogProps {
  step: "confirm1" | "confirm2";
  step1Message: string;
  step2Message: string;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: string | null;
  onAdvance: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  step,
  step1Message,
  step2Message,
  confirmLabel,
  pendingLabel,
  isPending,
  error,
  onAdvance,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dangerBtn =
    "flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50";
  const neutralBtn =
    "flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => !isPending && onCancel()}
    >
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "confirm1" ? (
          <>
            <p className="text-white font-semibold text-center">
              {step1Message}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onAdvance} className={dangerBtn}>
                {confirmLabel}
              </button>
              <button type="button" onClick={onCancel} className={neutralBtn}>
                No
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-center">
              {step2Message}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className={neutralBtn}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={dangerBtn}
              >
                {isPending ? pendingLabel : "Confirmar"}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

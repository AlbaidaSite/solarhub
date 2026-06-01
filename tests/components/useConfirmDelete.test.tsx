// @vitest-environment jsdom
// SUT: src/app/staff/components/useConfirmDelete.tsx
//
// Hook que encapsula la máquina de estado del borrado en 2 pasos. Test de
// integración del hook con ConfirmDialog: render → openDelete → flujo
// completo. Esto es lo que usan CromoAdminList, ArtistAdminList,
// StickerAdminList tras la Fase 2 del refactor.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConfirmDelete } from "@/app/staff/components/useConfirmDelete";

type DeleteResult = { ok: true } | { ok: false; error: string };

// Harness mínimo: un botón que abre el diálogo y muestra el resultado.
function Harness({
  action,
  onSuccess,
}: {
  action: (id: number) => Promise<DeleteResult>;
  onSuccess?: (id: number) => void;
}) {
  const hook = useConfirmDelete<number>({
    itemLabel: "cromo",
    action,
    onSuccess: onSuccess ?? (() => {}),
  });
  return (
    <>
      <button onClick={() => hook.openDelete(42)}>open</button>
      {hook.dialog}
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("useConfirmDelete · flujo completo OK", () => {
  it("openDelete abre el diálogo con itemLabel inyectado en el mensaje", async () => {
    render(<Harness action={vi.fn()} />);
    expect(screen.queryByText(/¿Estás seguro/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("open"));
    expect(
      screen.getByText(/¿Estás seguro de que quieres eliminar este cromo\?/i),
    ).toBeInTheDocument();
  });

  it("advance → confirm llama a action con el id correcto y dispara onSuccess", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    render(<Harness action={action} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: /Sí, estoy seguro/i }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(action).toHaveBeenCalledWith(42));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(42));
    // El diálogo se cierra tras éxito.
    await waitFor(() =>
      expect(screen.queryByText(/Esta acción no se puede deshacer/i)).not.toBeInTheDocument(),
    );
  });
});

describe("useConfirmDelete · fallo de la action", () => {
  it("muestra el error en el modal y NO cierra ni llama a onSuccess", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "FK violation" });
    const onSuccess = vi.fn();
    render(<Harness action={action} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: /Sí, estoy seguro/i }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("FK violation")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    // El step 2 sigue visible.
    expect(
      screen.getByText(/Esta acción no se puede deshacer/i),
    ).toBeInTheDocument();
  });
});

describe("useConfirmDelete · cancelar", () => {
  it("click en No cierra el diálogo sin llamar a la action", async () => {
    const action = vi.fn();
    render(<Harness action={action} />);

    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByRole("button", { name: "No" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Estás seguro/)).not.toBeInTheDocument();
  });
});

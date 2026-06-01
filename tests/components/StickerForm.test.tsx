// @vitest-environment jsdom
// SUT: src/app/staff/mapa/components/StickerForm.tsx
//
// Cubre el bug histórico: el input file estaba `className="hidden"` con
// atributo `required`. El navegador no podía mostrar el popup de validación
// sobre un campo invisible, así que bloqueaba el submit en silencio sin
// avisar al usuario. La fix fue mover la validación a JS (handleSubmit) y
// quitar el `required` del input. Estos tests blindan ese comportamiento.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Stub mínimo de next/navigation y next/image: ambos accederían a APIs
// específicas de Next que no existen en jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    return <img src={src} alt={alt} />;
  },
}));

import StickerForm from "@/app/staff/mapa/components/StickerForm";

// jsdom 29 no implementa URL.createObjectURL / revokeObjectURL. El form
// los usa para mostrar la preview de la imagen subida; los stubeamos para
// que la subida en los tests resulte en un `previewUrl` no-null y la
// validación JS pase.
beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  URL.createObjectURL = vi.fn(() => "blob:test/fake");
  URL.revokeObjectURL = vi.fn();
});

describe("StickerForm · validación JS de imagen requerida en modo crear", () => {
  it("submit sin imagen muestra error y NO llama a la action", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<StickerForm action={action} submitLabel="Crear sticker" />);

    await userEvent.type(screen.getByLabelText(/nombre/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /crear sticker/i }));

    expect(
      await screen.findByText(/debes seleccionar una imagen/i),
    ).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("el input file está hidden Y no tiene atributo required (la validación es JS)", () => {
    render(<StickerForm action={vi.fn()} submitLabel="Crear" />);
    const file = document.querySelector('input[name="icon"]') as HTMLInputElement;
    expect(file).toBeTruthy();
    expect(file.className).toContain("hidden");
    expect(file.required).toBe(false);
  });

  it("submit con imagen seleccionada llama a la action", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<StickerForm action={action} submitLabel="Crear" />);

    // El campo nombre es required: lo rellenamos antes para que la
    // validación nativa del form no bloquee el submit.
    await userEvent.type(screen.getByLabelText(/nombre/i), "MiSticker");

    const file = new File(["x"], "icon.webp", { type: "image/webp" });
    const fileInput = document.querySelector(
      'input[name="icon"]',
    ) as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});

describe("StickerForm · modo editar (existingIconUrl)", () => {
  it("NO requiere imagen para enviar (preserva la existente)", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(
      <StickerForm
        action={action}
        submitLabel="Guardar"
        existingIconUrl="http://test/old.webp"
        initial={{ name: "Old" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("muestra la imagen actual como preview", () => {
    render(
      <StickerForm
        action={vi.fn()}
        submitLabel="Guardar"
        existingIconUrl="http://test/old.webp"
        initial={{ name: "Old" }}
      />,
    );
    expect(screen.getByAltText(/icono del sticker/i)).toHaveAttribute(
      "src",
      "http://test/old.webp",
    );
  });
});

describe("StickerForm · errores del servidor", () => {
  it("acumula multi-línea con whitespace-pre-line cuando la action falla", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Error A\nError B" });
    render(<StickerForm action={action} submitLabel="Crear" />);

    const file = new File(["x"], "icon.webp", { type: "image/webp" });
    const fileInput = document.querySelector(
      'input[name="icon"]',
    ) as HTMLInputElement;
    await userEvent.upload(fileInput, file);
    await userEvent.type(screen.getByLabelText(/nombre/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    const err = await screen.findByText(/Error A/);
    expect(err.textContent).toContain("Error A");
    expect(err.textContent).toContain("Error B");
    expect(err.className).toContain("whitespace-pre-line");
  });
});

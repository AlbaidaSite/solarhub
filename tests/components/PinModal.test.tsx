// @vitest-environment jsdom
// SUT: src/app/(app)/mapa/components/PinModal.tsx
//
// Cubre el armazón que PinModal comparte con EventDetailModal.tsx —
// role="dialog" + aria-modal, título accesible, trampa de foco y bloqueo
// del scroll del <main> — más el cierre con Escape y el carrusel de
// multimedia. La trampa de foco es lo que impide tabular hasta los
// controles del mapa que quedan debajo (el otro medio bloqueo, congelar
// el globo, vive en GlobeClient.tsx).

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PinDetail } from "@/types/map";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// Igual que en EventDetailModal.test.tsx: sin este stub, useRouter()
// revienta en jsdom por no haber <AppRouterContext> de verdad.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(app)/mapa/actions", () => ({
  checkPinEditPermissionAction: vi.fn(),
  deletePinAction: vi.fn(),
}));

import {
  checkPinEditPermissionAction,
  deletePinAction,
} from "@/app/(app)/mapa/actions";
import PinModal from "@/app/(app)/mapa/components/PinModal";

const baseDetail: PinDetail = {
  pin: {
    id: 7,
    user_id: "u-A",
    sticker_id: 3,
    country_code: "ES",
    state: "Sevilla",
    place: "Parque del Retiro",
    latitude: 37.4084606,
    longitude: -6.0798973,
    created_at: "2026-05-26T12:00:00Z",
  },
  countryName: "España",
  username: "horgarler",
  sticker: { id: 3, name: "Sol naciente", icon_path: "https://cdn.test/stickers/sol.webp" },
  media: [
    { id: 11, pin_id: 7, url: "https://cdn.test/map/foto-1.webp", type: "PHOTO" },
    { id: 12, pin_id: 7, url: "https://cdn.test/map/video-1.mp4", type: "VIDEO" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  document.body.innerHTML = "";
  const main = document.createElement("main");
  main.style.overflow = "auto";
  document.body.appendChild(main);
  // Sin permiso por defecto: los botones de editar/eliminar no se pintan
  // salvo en los tests que específicamente los cubren.
  vi.mocked(checkPinEditPermissionAction).mockResolvedValue(false);
  vi.mocked(deletePinAction).mockResolvedValue({ ok: true });
});

describe("PinModal · armazón de diálogo (mismo que EventDetailModal)", () => {
  it("expone role=dialog con aria-modal y se nombra con el título del pin", () => {
    render(<PinModal detail={baseDetail} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const title = screen.getByRole("heading", { level: 1, name: "Parque del Retiro" });
    expect(title).toHaveAttribute("id", dialog.getAttribute("aria-labelledby"));
  });

  it("atrapa el foco dentro del modal: tabular no alcanza nada de fuera", async () => {
    // Un control del mapa "por debajo" del modal. Con la trampa de foco
    // del FocusScope, ningún Tab debe posarse sobre él.
    const outside = document.createElement("button");
    outside.textContent = "Añadir Pegatina";
    document.body.appendChild(outside);

    render(<PinModal detail={baseDetail} onClose={vi.fn()} />);

    // Basta con recorrer más paradas de las que tiene el modal: si el foco
    // se escapara, caería en el botón de fuera en alguna de ellas.
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(document.activeElement).not.toBe(outside);
      expect(document.activeElement).not.toBe(document.body);
    }
  });

  it("al montar bloquea el scroll de <main>, al desmontar lo restaura", () => {
    const main = document.querySelector("main")!;
    const { unmount } = render(<PinModal detail={baseDetail} onClose={vi.fn()} />);
    expect(main.style.overflow).toBe("hidden");
    unmount();
    expect(main.style.overflow).toBe("auto");
  });
});

describe("PinModal · cierre", () => {
  it("Escape llama a onClose", async () => {
    const onClose = vi.fn();
    render(<PinModal detail={baseDetail} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con la confirmación de borrado abierta, Escape la cierra sin cerrar el modal", async () => {
    vi.mocked(checkPinEditPermissionAction).mockResolvedValue(true);
    const onClose = vi.fn();
    render(<PinModal detail={baseDetail} onClose={onClose} />);

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar pegatina" }));
    expect(screen.getByText("¿Eliminar esta pegatina?")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("¿Eliminar esta pegatina?")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("PinModal · multimedia", () => {
  it("muestra la primera foto y cambia de archivo desde el carrusel", async () => {
    render(<PinModal detail={baseDetail} onClose={vi.fn()} />);

    expect(screen.getByAltText("Parque del Retiro")).toHaveAttribute(
      "src",
      "https://cdn.test/map/foto-1.webp",
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver vídeo 2" }));

    // El vídeo activo se pinta como <video>, ya no como <img>.
    expect(screen.queryByAltText("Parque del Retiro")).not.toBeInTheDocument();
    await waitFor(() => {
      const videos = document.querySelectorAll("video");
      expect(
        Array.from(videos).some((v) => v.getAttribute("src") === "https://cdn.test/map/video-1.mp4"),
      ).toBe(true);
    });
  });

  it("con un solo archivo no dibuja el carrusel", () => {
    render(
      <PinModal
        detail={{ ...baseDetail, media: [baseDetail.media[0]] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Ver (foto|vídeo)/ })).not.toBeInTheDocument();
  });

  it("un pin antiguo sin multimedia sigue abriéndose, con la tesela de la pegatina", () => {
    render(<PinModal detail={{ ...baseDetail, media: [] }} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Parque del Retiro" })).toBeInTheDocument();
    expect(screen.queryByAltText("Parque del Retiro")).not.toBeInTheDocument();
  });
});

describe("PinModal · borrado en dos pasos", () => {
  it("solo tras confirmar dos veces se invoca deletePinAction y se avisa al llamante", async () => {
    vi.mocked(checkPinEditPermissionAction).mockResolvedValue(true);
    const onDelete = vi.fn();
    render(<PinModal detail={baseDetail} onClose={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar pegatina" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    expect(deletePinAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(deletePinAction).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it("sin permiso no se ofrecen editar ni eliminar", async () => {
    render(<PinModal detail={baseDetail} onClose={vi.fn()} />);
    await waitFor(() => expect(checkPinEditPermissionAction).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Eliminar pegatina" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar pegatina" })).not.toBeInTheDocument();
  });
});

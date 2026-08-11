// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/EventDetailModal.tsx
//
// Cubre: bloqueo de scroll del <main>, cierre/vuelta con Escape, la
// guarda de desarrollo contra cumpleaños (nunca deben llegar aquí, ver
// BirthdayPills.tsx/EventListModal.tsx), la carga bajo demanda de
// precios (nada visible mientras carga o si no hay filas — nunca un
// spinner ni la cabecera "Precio" de por medio) y que compartir copia
// el enlace al portapapeles.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventOccurrence } from "@/types/events";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// Stub mínimo de next/navigation: el modal usa useRouter() para navegar a
// "editar" — sin este stub, renderizar el componente en jsdom revienta con
// "invariant expected app router to be mounted" (no hay <AppRouterContext>
// de verdad en un test de componente aislado).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(app)/eventos/actions", () => ({
  getEventPricesAction: vi.fn(),
  getEventExtraPhotosAction: vi.fn(),
  checkEventEditPermissionAction: vi.fn(),
  deleteEventAction: vi.fn(),
  toggleEventInterestAction: vi.fn(),
}));

import {
  checkEventEditPermissionAction,
  deleteEventAction,
  getEventExtraPhotosAction,
  getEventPricesAction,
} from "@/app/(app)/eventos/actions";
import EventDetailModal from "@/app/(app)/eventos/components/EventDetailModal";

const baseOccurrence: EventOccurrence = {
  id: 1,
  occurrenceDate: "2026-06-15",
  title: "Fiesta de verano",
  description: "Trae toalla",
  place: "Sede",
  imageUrl: "https://cdn.test/event-1.webp",
  url: "https://example.com",
  includesCromo: true,
  eventDate: "2026-06-15T18:00:00Z",
  endDate: null,
  startTimeIncluded: true,
  endTimeIncluded: true,
  liked: false,
  eventType: {
    id: 3,
    code: "PARTY",
    name: "Fiesta",
    icon_path: "https://cdn.test/icons/party.svg",
    color: "amber-400",
  },
};

const birthdayOccurrence: EventOccurrence = {
  ...baseOccurrence,
  id: 2,
  title: "Cumple de Ana",
  eventType: {
    id: 9,
    code: "BIRTHDAY",
    name: "Cumpleaños",
    icon_path: "https://cdn.test/icons/birthday.svg",
    color: "rose-400",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  document.body.innerHTML = "";
  const main = document.createElement("main");
  main.style.overflow = "auto";
  document.body.appendChild(main);
  vi.mocked(getEventPricesAction).mockResolvedValue([]);
  vi.mocked(getEventExtraPhotosAction).mockResolvedValue([]);
  // Sin permiso por defecto: los tests existentes no esperan ver los
  // botones de editar/eliminar en pantalla. Los tests específicos de esa
  // funcionalidad sobreescriben esto con mockResolvedValueOnce.
  vi.mocked(checkEventEditPermissionAction).mockResolvedValue({ isOwner: false, isStaff: false });
  vi.mocked(deleteEventAction).mockResolvedValue({ ok: true });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("EventDetailModal · guarda contra cumpleaños", () => {
  it("con un cumpleaños, no renderiza nada y avisa por consola", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <EventDetailModal occurrence={birthdayOccurrence} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("EventDetailModal · scroll lock del fondo", () => {
  it("al montar bloquea el scroll de <main>, al desmontar lo restaura", () => {
    const main = document.querySelector("main")!;
    const { unmount } = render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    expect(main.style.overflow).toBe("hidden");
    unmount();
    expect(main.style.overflow).toBe("auto");
  });
});

describe("EventDetailModal · cierre y navegación", () => {
  it("sin onBack, Escape llama a onClose", async () => {
    const onClose = vi.fn();
    render(<EventDetailModal occurrence={baseOccurrence} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).not.toBeInTheDocument();
  });

  it("con onBack, Escape llama a onBack (no a onClose) y se muestra la flecha volver", async () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    render(<EventDetailModal occurrence={baseOccurrence} onClose={onClose} onBack={onBack} />);
    expect(screen.getByRole("button", { name: "Volver a la lista" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("EventDetailModal · precios bajo demanda", () => {
  it("mientras carga, no muestra nada (ni spinner ni la cabecera 'Precio')", () => {
    vi.mocked(getEventPricesAction).mockReturnValue(new Promise(() => {}));
    render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    expect(screen.queryByText("Precio")).not.toBeInTheDocument();
  });

  it("con precios, los lista formateados en es-ES/EUR", async () => {
    vi.mocked(getEventPricesAction).mockResolvedValue([
      { id: 1, reason: "Anticipada", price: 12.5 },
      { id: 2, reason: null, price: 15 },
    ]);
    render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    expect(await screen.findByText("12,50 €")).toBeInTheDocument();
    expect(screen.getByText("15,00 €")).toBeInTheDocument();
    expect(screen.getByText("Entrada")).toBeInTheDocument();
  });

  it("sin precios, oculta el bloque de precios por completo", async () => {
    vi.mocked(getEventPricesAction).mockResolvedValue([]);
    render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    await waitFor(() => expect(getEventPricesAction).toHaveBeenCalledWith(baseOccurrence.id));
    expect(screen.queryByText("Precio")).not.toBeInTheDocument();
  });

  it("si la acción falla, no se queda esperando para siempre: se resuelve a 'sin precio'", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getEventPricesAction).mockRejectedValue(new Error("network down"));
    render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.queryByText("Precio")).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

describe("EventDetailModal · compartir", () => {
  it("copia el enlace del evento al portapapeles y muestra confirmación", async () => {
    render(<EventDetailModal occurrence={baseOccurrence} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar enlace del evento" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const [copiedUrl] = vi.mocked(navigator.clipboard.writeText).mock.calls[0];
    expect(copiedUrl).toContain("evento=1");
    expect(copiedUrl).toContain("fecha=2026-06-15");
    expect(await screen.findByText("Enlace copiado")).toBeInTheDocument();
  });
});

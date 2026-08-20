// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/EventListModal.tsx
//
// Cubre: orden (cumpleaños primero), filas de cumpleaños no interactivas,
// clic en un evento normal abre su detalle, el botón "+" crea un evento
// ese día, Escape cierra y bloqueo de scroll del fondo.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventOccurrence } from "@/types/events";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// La campana de interés llama a esta acción de servidor — mockeada para no
// arrastrar aquí el cliente de Supabase real (mismo motivo que en
// EventDetailModal.test.tsx).
vi.mock("@/app/(app)/eventos/actions", () => ({
  toggleEventInterestAction: vi.fn(),
}));

import { toggleEventInterestAction } from "@/app/(app)/eventos/actions";
import EventListModal from "@/app/(app)/eventos/components/EventListModal";

function makeOccurrence(overrides: Partial<EventOccurrence> & { id: number }): EventOccurrence {
  return {
    occurrenceDate: "2026-06-15",
    title: `Evento ${overrides.id}`,
    description: null,
    place: null,
    imageUrl: null,
    url: null,
    includesCromo: false,
    eventDate: "2026-06-15T18:00:00Z",
    endDate: null,
    startTimeIncluded: true,
    endTimeIncluded: true,
    liked: false,
    eventType: {
      id: 1,
      code: "GENERIC",
      name: "Genérico",
      icon_path: "https://cdn.test/icons/generic.svg",
      color: "amber-400",
    },
    ...overrides,
  };
}

function makeBirthday(overrides: Partial<EventOccurrence> & { id: number }): EventOccurrence {
  return makeOccurrence({
    eventType: {
      id: 9,
      code: "BIRTHDAY",
      name: "Cumpleaños",
      icon_path: "https://cdn.test/icons/birthday.svg",
      color: "rose-400",
    },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  document.body.innerHTML = "";
  const main = document.createElement("main");
  main.style.overflow = "auto";
  document.body.appendChild(main);
  vi.mocked(toggleEventInterestAction).mockResolvedValue({ ok: true, liked: true });
});

describe("EventListModal · cabecera", () => {
  it("muestra la fecha completa en español", () => {
    render(
      <EventListModal
        dateKey="2026-06-12"
        occurrences={[]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /viernes, 12 de junio/i })).toBeInTheDocument();
  });
});

describe("EventListModal · orden", () => {
  it("los cumpleaños se listan antes que el resto de eventos", () => {
    const party = makeOccurrence({ id: 1, title: "Fiesta" });
    const birthday = makeBirthday({ id: 2, title: "Cumple de Ana" });
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[party, birthday]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const titles = screen.getAllByText(/Fiesta|Cumple de Ana/).map((el) => el.textContent);
    expect(titles).toEqual(["Cumple de Ana", "Fiesta"]);
  });
});

describe("EventListModal · interacción por fila", () => {
  it("clic en un evento normal llama a onSelectEvent con su id", async () => {
    const party = makeOccurrence({ id: 1, title: "Fiesta" });
    const onSelectEvent = vi.fn();
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[party]}
        onSelectEvent={onSelectEvent}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Fiesta/ }));
    expect(onSelectEvent).toHaveBeenCalledWith(1);
  });

  it("la fila de cumpleaños no es interactiva: sin role button, sin tabIndex, el clic no hace nada", async () => {
    const birthday = makeBirthday({ id: 2, title: "Cumple de Ana" });
    const onSelectEvent = vi.fn();
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[birthday]}
        onSelectEvent={onSelectEvent}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Cumple de Ana/ })).not.toBeInTheDocument();
    const row = screen.getByText("Cumple de Ana").closest("li")!.firstElementChild as HTMLElement;
    expect(row).not.toHaveAttribute("role", "button");
    expect(row).not.toHaveAttribute("tabindex");
    await userEvent.click(row);
    expect(onSelectEvent).not.toHaveBeenCalled();
  });
});

describe("EventListModal · nuevo evento y cierre", () => {
  it("el botón + llama a onCreateEvent con la fecha del día", async () => {
    const onCreateEvent = vi.fn();
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[]}
        onSelectEvent={vi.fn()}
        onCreateEvent={onCreateEvent}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nuevo evento este día" }));
    expect(onCreateEvent).toHaveBeenCalledWith("2026-06-15");
  });

  it("Escape llama a onClose", async () => {
    const onClose = vi.fn();
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("al montar bloquea el scroll de <main>, al desmontar lo restaura", () => {
    const main = document.querySelector("main")!;
    const { unmount } = render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(main.style.overflow).toBe("hidden");
    unmount();
    expect(main.style.overflow).toBe("auto");
  });
});


describe("EventListModal · interés en eventos pasados", () => {
  // Solo Date: falsear también los temporizadores cuelga a userEvent.
  const freezeToday = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("una fila de un evento pasado no lleva campana", () => {
    freezeToday("2026-06-16T09:00:00Z");
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[makeOccurrence({ id: 1 })]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /interés/i })).not.toBeInTheDocument();
  });

  it("una fila de un evento por venir sí la lleva", () => {
    freezeToday("2026-06-01T09:00:00Z");
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[makeOccurrence({ id: 1 })]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Mostrar interés" })).toBeInTheDocument();
  });

  // Un cumpleaños vuelve cada año, así que mirar el de marzo en agosto no
  // lo convierte en pasado: su campana sigue ahí.
  it("un cumpleaños conserva la campana aunque su día ya haya pasado", () => {
    freezeToday("2026-08-18T09:00:00Z");
    render(
      <EventListModal
        dateKey="2026-06-15"
        occurrences={[makeBirthday({ id: 2 })]}
        onSelectEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Mostrar interés" })).toBeInTheDocument();
  });
});

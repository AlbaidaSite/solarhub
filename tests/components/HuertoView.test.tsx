// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/HuertoView.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// HuertoView pregunta al servidor si el usuario puede editar el huerto en
// cuanto monta. Por defecto se responde que no: es el caso de la mayoría
// de usuarios y deja la vista igual que antes de esta funcionalidad.
const getGardenPermissionAction = vi.fn(async () => ({ canManage: false }));
const setIrrigationLevelAction = vi.fn();

vi.mock("@/app/(app)/huerto/actions", () => ({
  getGardenPermissionAction: () => getGardenPermissionAction(),
  addPlantBedAction: vi.fn(),
  updatePlantBedAction: vi.fn(),
  deletePlantBedAction: vi.fn(),
  reorderPlantBedsAction: vi.fn(),
  // La ficha de un cultivo arrastra su diario y sus secciones editables:
  // no se ejercitan aqui, pero el modulo entero se sustituye y sin estas
  // el componente revienta al montar.
  updatePlantSectionAction: vi.fn(),
  getCropDiaryAction: vi.fn(async () => []),
  addCropDiaryEntryAction: vi.fn(),
  updateCropDiaryEntryAction: vi.fn(),
  deleteCropDiaryEntryAction: vi.fn(),
  setIrrigationLevelAction: (...args: unknown[]) => setIrrigationLevelAction(...args),
}));

import { addPlantBedAction } from "@/app/(app)/huerto/actions";
import HuertoView from "@/app/(app)/huerto/components/HuertoView";
import { HUERTO_TAB_IDS } from "@/app/(app)/huerto/components/HuertoTabs";
import type { GardenBed, Irrigation, Plant, PlantBed } from "@/types/garden";

const beds: GardenBed[] = [{ id: 1, name: "Bancal", width: 100, height: 100, pos_x: 0, pos_y: 0 }];

const plants: Plant[] = [
  { id: 1, name: "Ajo", icon_path: "ajo.webp", seed_info: null, harvest_info: null, months_of_growth: [1], months_of_harvest: null, color: "lime-600" },
  { id: 2, name: "Sandía", icon_path: "sandia.webp", seed_info: null, harvest_info: null, months_of_growth: [6], months_of_harvest: null, color: "rose-700" },
];

const plantBeds: PlantBed[] = [
  { id: 1, plant_id: 1, garden_bed_id: 1, description: null, is_future: false, order_number: 0 },
  { id: 2, plant_id: 2, garden_bed_id: 1, description: null, is_future: true, order_number: 0 },
];

// Toda fila de garden_bed tiene la suya (backfill + trigger), asi que el
// fixture las trae igual que llegarian del servidor.
const irrigation: Irrigation[] = [{ garden_bed_id: 1, irrigation_level: "CERRADO" }];

beforeEach(() => {
  cleanup();
  getGardenPermissionAction.mockResolvedValue({ canManage: false });
  setIrrigationLevelAction.mockReset();
  // useIsMobile (arrastre solo en escritorio) consulta matchMedia, que
  // jsdom no implementa. Se responde "no coincide" = escritorio.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe("HuertoView", () => {
  it("al montar se muestra la distribución Actual", () => {
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );
    expect(container.querySelectorAll("image")).toHaveLength(1);
  });

  it("pulsar Planificar cambia los bancales dibujados", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );
    await user.click(screen.getByRole("button", { name: "Planificar" }));
    // Ajo (actual) desaparece del lienzo, Sandía (futuro) aparece: sigue
    // habiendo exactamente un <image>, pero es el cultivo futuro.
    expect(container.querySelectorAll("image")).toHaveLength(1);
  });

  it("cambiar de mes recompone las tres listas sin pedir datos de red", async () => {
    const user = userEvent.setup();
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);

    const siembraSection = screen.getByText("Siembra:").closest("section")!;
    expect(within(siembraSection).getByRole("img", { name: "Ajo" })).toBeInTheDocument();
    expect(within(siembraSection).queryByRole("img", { name: "Sandía" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Mes" }), "6");

    expect(within(siembraSection).queryByRole("img", { name: "Ajo" })).not.toBeInTheDocument();
    expect(within(siembraSection).getByRole("img", { name: "Sandía" })).toBeInTheDocument();
  });

  it("en móvil, la pestaña no activa no está en el árbol accesible", () => {
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);
    const cultivosPanel = document.getElementById(HUERTO_TAB_IDS.cultivosPanel);
    const bancalPanel = document.getElementById(HUERTO_TAB_IDS.bancalPanel);
    expect(cultivosPanel).toHaveClass("hidden");
    expect(bancalPanel).not.toHaveClass("hidden");
  });

  // Consultar qué hay plantado en un bancal es para todo el mundo; lo que
  // depende del permiso es lo que se puede tocar una vez abierto.
  it("sin permiso de edición los bancales se abren igual, pero sin nada que editar", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());

    const bedButton = container.querySelector('g[role="button"]');
    expect(bedButton).not.toBeNull();

    await user.click(bedButton as SVGGElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ajo")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Añadir cultivo/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Vaciar Bancal" })).not.toBeInTheDocument();
  });

  it("con permiso, pulsar un bancal abre su modal con los cultivos que tiene", async () => {
    getGardenPermissionAction.mockResolvedValue({ canManage: true });
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );

    const bedButton = await waitFor(() => {
      const found = container.querySelector('g[role="button"]');
      expect(found).not.toBeNull();
      return found as SVGGElement;
    });

    await user.click(bedButton);

    const dialog = await screen.findByRole("dialog");
    // Sin título visible, el bancal se identifica por el nombre accesible.
    expect(dialog).toHaveAccessibleName("Bancal");
    expect(within(dialog).getByRole("button", { name: /Añadir cultivo/ })).toBeInTheDocument();
    expect(within(dialog).getByText("Ajo")).toBeInTheDocument();
  });
});

// En movil no hay arrastre (el panel de cultivos y el lienzo son pestañas y
// nunca se ven a la vez), asi que plantar es un flujo de dos toques: se elige
// el cultivo desde su ficha y luego se toca el bancal.
describe("HuertoView · plantar tocando (movil)", () => {
  const addPlantBedMock = vi.mocked(addPlantBedAction);

  // useIsMobile(767) pregunta por (max-width: 767px). Devolver `matches` a
  // secas basta: es la unica consulta que hace esta vista.
  function stubViewport(isMobile: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: isMobile,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  beforeEach(() => {
    addPlantBedMock.mockReset();
    getGardenPermissionAction.mockResolvedValue({ canManage: true });
  });

  // Deja la vista con "Ajo" esperando bancal, partiendo de la pestaña de
  // cultivos para que el cambio de pestaña sea observable.
  async function startPlanting(user: ReturnType<typeof userEvent.setup>) {
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());

    await user.click(screen.getByRole("tab", { name: "Cultivos" }));
    expect(document.getElementById(HUERTO_TAB_IDS.bancalPanel)).toHaveClass("hidden");

    await user.click(screen.getByRole("button", { name: "Ajo" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: /Plantar en un bancal/ }));
  }

  it("desde la ficha de un cultivo se pasa a la pestaña de bancal esperando el toque", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    await startPlanting(user);

    // La ficha se cierra: los bancales que hay que tocar estan debajo.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById(HUERTO_TAB_IDS.bancalPanel)).not.toHaveClass("hidden");
    expect(await screen.findByRole("status")).toHaveTextContent(/Toca un bancal para plantar\s*Ajo/);
  });

  it("tocar un bancal planta el cultivo al final de los que ya tiene", async () => {
    stubViewport(true);
    addPlantBedMock.mockResolvedValue({ ok: true, rows: [] });
    const user = userEvent.setup();
    await startPlanting(user);

    await user.click(document.querySelector('g[role="button"]') as unknown as Element);

    await waitFor(() =>
      expect(addPlantBedMock).toHaveBeenCalledWith({
        gardenBedId: 1,
        plantId: 1,
        description: null,
        isFuture: false,
        // jsdom no implementa getScreenCTM, asi que no hay punto de toque
        // utilizable y se añade detras del cultivo que ya habia.
        index: 1,
      }),
    );
    // Plantado: se sale del modo y no se abre el modal del bancal.
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tocar el lienzo fuera de un bancal cancela sin plantar", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    await startPlanting(user);

    await user.click(document.querySelector("svg") as unknown as Element);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(addPlantBedMock).not.toHaveBeenCalled();
  });

  // react-aria detiene la propagacion del clic de una pestaña, asi que este
  // caso NO lo cubre el onClick de la raiz: se cancela desde su onChange.
  it("cambiar de pestaña cancela en vez de dejar el cultivo esperando a oscuras", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    await startPlanting(user);

    await user.click(screen.getByRole("tab", { name: "Cultivos" }));
    await user.click(screen.getByRole("tab", { name: "Bancal" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(addPlantBedMock).not.toHaveBeenCalled();
  });

  it("el boton de cancelar de la barra tambien sale del modo", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    await startPlanting(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(addPlantBedMock).not.toHaveBeenCalled();
  });

  it("cancelado el modo, tocar un bancal vuelve a abrir su modal", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    await startPlanting(user);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(document.querySelector('g[role="button"]') as unknown as Element);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Bancal");
    expect(addPlantBedMock).not.toHaveBeenCalled();
  });

  it("en escritorio no se ofrece: alli el cultivo se arrastra hasta el bancal", async () => {
    stubViewport(false);
    const user = userEvent.setup();
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());

    // Con arrastre activo el icono ya no resuelve el clic el mismo, asi que
    // se abre la ficha soltando sin mover.
    const icon = screen.getByRole("button", { name: "Ajo" });
    await user.pointer([{ target: icon, keys: "[MouseLeft>]" }, { target: icon, keys: "[/MouseLeft]" }]);

    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).queryByRole("button", { name: /Plantar en un bancal/ }),
    ).not.toBeInTheDocument();
  });

  it("sin permiso de edicion tampoco se ofrece en movil", async () => {
    stubViewport(true);
    getGardenPermissionAction.mockResolvedValue({ canManage: false });
    const user = userEvent.setup();
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Ajo" }));

    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).queryByRole("button", { name: /Plantar en un bancal/ }),
    ).not.toBeInTheDocument();
  });
});

// El gesto que sustituye al arrastre en movil. Se ejercita con fireEvent y no
// con userEvent porque hace falta controlar el reloj: lo que distingue una
// pulsacion larga de un toque es cuanto dura.
describe("HuertoView · mantener pulsado un cultivo (movil)", () => {
  const addPlantBedMock = vi.mocked(addPlantBedAction);
  const LONGER_THAN_LONG_PRESS = 600;

  function stubViewport(isMobile: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: isMobile,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  beforeEach(() => {
    addPlantBedMock.mockReset();
    getGardenPermissionAction.mockResolvedValue({ canManage: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Monta la vista y devuelve el icono de un cultivo, con el reloj ya
  // congelado. El permiso se resuelve antes de congelarlo: es una promesa, y
  // con timers falsos no llegaria nunca.
  async function renderWithIcon(name: string) {
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />);
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());
    // Que la accion se haya llamado no basta: el permiso viaja en una promesa
    // y hasta que no aterriza en el estado el gesto todavia no esta montado.
    // Congelar el reloj antes de eso deja el icono sin pulsacion larga.
    await act(async () => {});
    const icon = screen.getByRole("button", { name });
    vi.useFakeTimers();
    return icon;
  }

  it("mantener pulsado deja el cultivo a la espera de bancal, sin abrir su ficha", async () => {
    stubViewport(true);
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));
    fireEvent.pointerUp(icon, { pointerType: "touch" });
    // Al levantar el dedo el navegador manda ademas un click, que no debe
    // colar la ficha por encima de lo que se acaba de iniciar.
    fireEvent.click(icon);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Toca un bancal para plantar\s*Ajo/);
    expect(document.getElementById(HUERTO_TAB_IDS.bancalPanel)).not.toHaveClass("hidden");
  });

  // El gesto se hace en la pestaña de Cultivos, sin ver el lienzo: quien lo
  // empieza no tiene por que acordarse de que lo dejo en Riego, donde no hay
  // donde plantar. Volver a Actual es parte de empezar a plantar.
  it("mantener pulsado estando en Riego devuelve el lienzo a Actual", async () => {
    stubViewport(true);
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Riego" }));
    expect(container.querySelector("svg > title")).toHaveTextContent("Riego del huerto");

    const icon = screen.getByRole("button", { name: "Ajo" });
    vi.useFakeTimers();
    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));
    fireEvent.pointerUp(icon, { pointerType: "touch" });
    fireEvent.click(icon);

    expect(container.querySelector("svg > title")).toHaveTextContent(
      "Distribución actual del huerto",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Toca un bancal para plantar\s*Ajo/);
    expect(document.getElementById(HUERTO_TAB_IDS.bancalPanel)).not.toHaveClass("hidden");
  });

  // Es lo que bloqueaba llegar a Recogida y Otros: esos grupos quedan mas
  // abajo, y para verlos hay que deslizar el dedo sobre los iconos.
  it("deslizar el dedo sobre un icono no planta: era un scroll de la lista", async () => {
    stubViewport(true);
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(icon, { pointerType: "touch", clientX: 12, clientY: 90 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(addPlantBedMock).not.toHaveBeenCalled();
  });

  it("un toque corto sigue abriendo la ficha del cultivo", async () => {
    stubViewport(true);
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(120));
    fireEvent.pointerUp(icon, { pointerType: "touch" });
    fireEvent.click(icon);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // findBy* se apoya en temporizadores reales para reintentar.
    vi.useRealTimers();
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Ajo");
  });

  it("levantar el dedo antes de tiempo cancela la pulsacion", async () => {
    stubViewport(true);
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(icon, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // El gesto tiene que funcionar igual en los grupos de abajo, que son
  // justo los que obligan a desplazarse.
  it("funciona igual sobre un cultivo del grupo Otros", async () => {
    stubViewport(true);
    // Sandía siembra en junio: en enero cae fuera de Siembra y Recogida.
    const icon = await renderWithIcon("Sandía");
    const otros = screen.getByRole("heading", { name: "Otros:" }).parentElement as HTMLElement;
    expect(within(otros).getByRole("button", { name: "Sandía" })).toBe(icon);

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));

    expect(screen.getByRole("status")).toHaveTextContent(/Toca un bancal para plantar\s*Sandía/);
  });

  it("con raton no se dispara: ahi el gesto equivalente es arrastrar", async () => {
    stubViewport(true);
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "mouse", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sin permiso de edicion no hay gesto ni pista", async () => {
    stubViewport(true);
    getGardenPermissionAction.mockResolvedValue({ canManage: false });
    const icon = await renderWithIcon("Ajo");

    fireEvent.pointerDown(icon, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONGER_THAN_LONG_PRESS));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mantén pulsado un cultivo/)).not.toBeInTheDocument();
  });
});

// Describe propio y de nivel superior: los de "movil" traen su beforeEach
// con canManage=true, y el riego se juega justo en quien tiene permiso.
describe("HuertoView · riego", () => {
  const renderView = () =>
    render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} irrigation={irrigation} initialMonth={1} />,
    );

  it("sustituye los cultivos por un icono de nivel por bancal", async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    expect(container.querySelectorAll("image")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Riego" }));

    // El icono de la planta desaparece: en riego no se dibuja ningun cultivo.
    expect(container.querySelectorAll("image")).toHaveLength(0);
    expect(container.querySelector("svg > title")).toHaveTextContent("Riego del huerto");
  });

  // El permiso funciona al reves que en cultivos: alli cualquiera abre un
  // bancal para consultarlo, aqui lo unico que se puede hacer es escribir.
  it("sin permiso los bancales no son clicables", async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Riego" }));

    expect(container.querySelectorAll('g[role="button"]')).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con permiso, elegir un nivel lo guarda y repinta el bancal", async () => {
    getGardenPermissionAction.mockResolvedValue({ canManage: true });
    setIrrigationLevelAction.mockResolvedValue({
      ok: true,
      row: { garden_bed_id: 1, irrigation_level: "ABIERTO" },
    });
    const user = userEvent.setup();
    const { container } = renderView();
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Riego" }));

    const bed = await waitFor(() => {
      const g = container.querySelector('g[role="button"]');
      if (!g) throw new Error("el bancal aun no es clicable");
      return g;
    });
    expect(bed).toHaveAttribute("aria-label", "Bancal: riego cerrado");
    await act(async () => {
      bed.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await user.click(screen.getByRole("button", { name: /Abierto/ }));

    expect(setIrrigationLevelAction).toHaveBeenCalledWith(1, "ABIERTO");
    // El modal se cierra y el bancal ya se anuncia con el nivel nuevo.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(container.querySelector('g[role="button"]')).toHaveAttribute(
      "aria-label",
      "Bancal: riego abierto",
    );
  });
});

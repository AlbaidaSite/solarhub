// @vitest-environment jsdom
// SUT: src/app/(app)/components/HomeMenu.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomeMenu from "@/app/(app)/components/HomeMenu";
import { MENU_ITEMS } from "@/constants/navigation";

// jsdom no aplica media queries, así que los dos menús (el cielo de
// escritorio y la rejilla de móvil) están siempre en el DOM: cada consulta
// se acota al suyo por el nombre del <nav>.
const sky = () => screen.getByRole("navigation", { name: "Secciones (constelaciones)" });
const grid = () => screen.getByRole("navigation", { name: "Secciones" });

beforeEach(cleanup);

describe("HomeMenu — cielo de escritorio", () => {
  it("hay una constelación por sección, cada una enlazando a su vista", () => {
    render(<HomeMenu />);

    const links = within(sky()).getAllByRole("link");
    expect(links).toHaveLength(MENU_ITEMS.length);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      MENU_ITEMS.map((item) => item.href),
    );
    expect(within(sky()).getByRole("link", { name: "Huerto" })).toBeInTheDocument();
  });

  it("sin nada señalado no se lee ningún nombre arriba", () => {
    const { container } = render(<HomeMenu />);
    const band = container.querySelector("[aria-hidden] span");
    expect(band).toHaveTextContent("");
  });

  it("señalar una constelación saca su nombre en la franja de arriba", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeMenu />);
    const band = container.querySelector("[aria-hidden] span") as HTMLElement;

    await user.hover(within(sky()).getByRole("link", { name: "Cromos" }));
    expect(band).toHaveTextContent("Cromos");

    await user.unhover(within(sky()).getByRole("link", { name: "Cromos" }));
    expect(band).toHaveTextContent("");
  });

  // El nombre también tiene que salir navegando con el teclado, que es la
  // única forma de "señalar" sin ratón.
  it("el nombre sale igual al enfocar con el teclado", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeMenu />);
    const band = container.querySelector("[aria-hidden] span") as HTMLElement;

    await user.tab();
    expect(band).toHaveTextContent("Cromos");
  });

  it("pasar de una constelación a otra cambia el nombre, no lo apaga", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeMenu />);
    const band = container.querySelector("[aria-hidden] span") as HTMLElement;

    await user.hover(within(sky()).getByRole("link", { name: "Cromos" }));
    expect(band).toHaveTextContent("Cromos");

    await user.hover(within(sky()).getByRole("link", { name: "Mapa" }));
    expect(band).toHaveTextContent("Mapa");
  });
});

describe("HomeMenu — rejilla de móvil", () => {
  it("enseña los iconos con su nombre, sin constelaciones", () => {
    render(<HomeMenu />);

    const links = within(grid()).getAllByRole("link");
    expect(links).toHaveLength(MENU_ITEMS.length);

    for (const item of MENU_ITEMS) {
      expect(within(grid()).getByText(item.label)).toBeInTheDocument();
    }

    // Un único <svg> por sección —su icono— y ninguno más: en el cielo cada
    // enlace lleva dos (la constelación debajo del icono).
    expect(grid().querySelectorAll("svg")).toHaveLength(MENU_ITEMS.length);
    expect(sky().querySelectorAll("svg")).toHaveLength(MENU_ITEMS.length * 2);
  });

  it("es una rejilla de dos columnas", () => {
    render(<HomeMenu />);
    expect(grid()).toHaveClass("grid-cols-2");
  });
});

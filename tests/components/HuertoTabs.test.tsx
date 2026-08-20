// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/HuertoTabs.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HuertoTabs from "@/app/(app)/huerto/components/HuertoTabs";

beforeEach(() => {
  cleanup();
});

describe("HuertoTabs", () => {
  it("expone role=tablist con dos role=tab y aria-selected correcto", () => {
    render(<HuertoTabs tab="bancal" onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Bancal" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Cultivos" })).toHaveAttribute("aria-selected", "false");
  });

  it("la flecha derecha mueve el foco y la selección a la siguiente pestaña", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HuertoTabs tab="bancal" onChange={onChange} />);

    screen.getByRole("tab", { name: "Bancal" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("cultivos");
  });

  it("la flecha izquierda desde la primera pestaña vuelve a la última", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HuertoTabs tab="bancal" onChange={onChange} />);

    screen.getByRole("tab", { name: "Bancal" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("cultivos");
  });
});

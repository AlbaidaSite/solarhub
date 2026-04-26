"use client";

import { useState } from "react";

type Panel = "eventos" | "historial";

export default function ProfilePanels() {
  const [panel, setPanel] = useState<Panel>("eventos");

  return (
    <div className="relative w-full flex flex-col md:flex-row md:items-stretch min-h-96">
      <div className="md:hidden w-full flex items-center justify-center gap-5 mb-8">
        <TabButton active={panel === "eventos"} onClick={() => setPanel("eventos")}>
          Eventos pendientes
        </TabButton>
        <span aria-hidden className="text-zinc-600 text-xl">/</span>
        <TabButton active={panel === "historial"} onClick={() => setPanel("historial")}>
          Historial
        </TabButton>
      </div>

      <PanelSection visible={panel === "eventos"} side="left">
        <h2 className="hidden md:block text-2xl font-bold text-white text-center mb-4">
          Eventos pendientes
        </h2>
        {/* Contenido pendiente */}
      </PanelSection>

      <div
        aria-hidden
        className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-linear-to-b from-transparent via-zinc-700 to-transparent"
      />

      <PanelSection visible={panel === "historial"} side="right">
        <h2 className="hidden md:block text-2xl font-bold text-white text-center mb-4">
          Historial
        </h2>
        {/* Contenido pendiente */}
      </PanelSection>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xl font-bold transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function PanelSection({
  visible,
  side,
  children,
}: {
  visible: boolean;
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`
        w-full
        ${visible ? "flex" : "hidden md:flex"}
        flex-col items-center
        md:flex-1 ${side === "left" ? "md:pr-8" : "md:pl-8"}
      `}
    >
      {children}
    </section>
  );
}

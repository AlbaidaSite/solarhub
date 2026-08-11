"use client";

import { useRef } from "react";
import { Item, useTabListState, type Node, type TabListState } from "react-stately";
import { useTabList, useTab } from "react-aria";
import { Grid3x2, Sprout } from "lucide-react";

export type HuertoTab = "bancal" | "cultivos";

// Ids fijos: HuertoTabs solo se monta una vez por página, así que no
// hace falta useId() para evitar colisiones entre instancias.
export const HUERTO_TAB_IDS = {
  bancalTab: "huerto-tab-bancal",
  cultivosTab: "huerto-tab-cultivos",
  bancalPanel: "huerto-panel-bancal",
  cultivosPanel: "huerto-panel-cultivos",
} as const;

interface HuertoTabsProps {
  tab: HuertoTab;
  onChange: (tab: HuertoTab) => void;
}

export default function HuertoTabs({ tab, onChange }: HuertoTabsProps) {
  const state = useTabListState<object>({
    selectedKey: tab,
    onSelectionChange: (key) => onChange(key as HuertoTab),
    // children de Item: contenido del panel asociado, sin uso aquí (los
    // paneles reales los renderiza HuertoView, no useTabPanel) — se
    // repite el título porque ItemProps lo exige como prop obligatoria.
    children: [
      <Item key="bancal" title="Bancal">Bancal</Item>,
      <Item key="cultivos" title="Cultivos">Cultivos</Item>,
    ],
  });

  const ref = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList({ "aria-label": "Vista de huerto" }, state, ref);

  return (
    <div {...tabListProps} ref={ref} className="md:hidden flex items-center justify-center gap-10">
      {[...state.collection].map((item) => (
        <TabButton key={item.key} item={item} state={state} />
      ))}
    </div>
  );
}

function TabButton({ item, state }: { item: Node<object>; state: TabListState<object> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { tabProps, isSelected } = useTab({ key: item.key }, state, ref);
  const isBancal = item.key === "bancal";
  const Icon = isBancal ? Grid3x2 : Sprout;
  const tabId = isBancal ? HUERTO_TAB_IDS.bancalTab : HUERTO_TAB_IDS.cultivosTab;
  const panelId = isBancal ? HUERTO_TAB_IDS.bancalPanel : HUERTO_TAB_IDS.cultivosPanel;

  return (
    <button
      {...tabProps}
      id={tabId}
      aria-controls={panelId}
      ref={ref}
      className="flex flex-col items-center gap-1 pb-1"
    >
      {/* El icono activo no se distingue solo por brillo: además lleva
          un borde inferior, para que se lea a pleno sol o con baja
          visión. */}
      <Icon
        size={24}
        className={isSelected ? "text-white" : "text-white/40"}
      />
      <span
        className={`text-xs border-b-2 ${
          isSelected ? "text-white border-cyan-400" : "text-white/40 border-transparent"
        }`}
      >
        {item.rendered}
      </span>
    </button>
  );
}

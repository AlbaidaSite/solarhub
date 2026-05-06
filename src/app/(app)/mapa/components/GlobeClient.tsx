"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl";
import type { Pin, Sticker } from "@/types/map";

interface GlobeClientProps {
  pins: Pin[];
  stickers: Map<number, Sticker>;
}

interface PinData {
  id: string;
  lat: number;
  lng: number;
  html: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

const GLOBE_IMAGE_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
const TILES_URL = (x: number, y: number, z: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const ICON_SIZE = 32;

export default function GlobeClient({ pins, stickers }: GlobeClientProps) {
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Formatear fecha
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Memoizar cálculo de posiciones con hash del pin para evitar recalculos innecesarios
  const htmlElements = useMemo(() => {
    const pinPositions = new Map<number, { lat: number; lng: number }>();

    // Agrupar pines por ubicación
    pins.forEach((pin) => {
      const key = Math.round(pin.latitude * 100) * 10000 + Math.round(pin.longitude * 100);
      if (!pinPositions.has(key)) {
        const cluster = pins.filter(
          (p) =>
            Math.abs(p.latitude - pin.latitude) < 0.01 &&
            Math.abs(p.longitude - pin.longitude) < 0.01
        );

        if (cluster.length === 1) {
          pinPositions.set(key, { lat: pin.latitude, lng: pin.longitude });
        } else {
          const index = cluster.findIndex((p) => p.id === pin.id);
          const angle = (index % cluster.length) * (Math.PI * 2 / cluster.length);
          const offsetRadius = 0.015;
          pinPositions.set(key, {
            lat: pin.latitude + Math.cos(angle) * offsetRadius,
            lng: pin.longitude + Math.sin(angle) * offsetRadius,
          });
        }
      }
    });

    return pins.map((pin) => {
      const sticker = stickers.get(pin.sticker_id);
      const key = Math.round(pin.latitude * 100) * 10000 + Math.round(pin.longitude * 100);
      const pos = pinPositions.get(key) || { lat: pin.latitude, lng: pin.longitude };
      const iconUrl = sticker?.icon_path || "/cromos/locked.webp";

      return {
        id: `pin-${pin.id}`,
        lat: pos.lat,
        lng: pos.lng,
        html: `
          <div
            class="relative cursor-pointer transition-transform hover:scale-125"
            data-pin-id="${pin.id}"
            data-place="${pin.place}"
            data-state="${pin.state || ""}"
            data-country="${pin.country_code}"
            data-created="${pin.created_at}"
            style="width: ${ICON_SIZE}px; height: ${ICON_SIZE}px;"
          >
            <img
              src="${iconUrl}"
              alt="${pin.place}"
              style="width: 100%; height: 100%; display: block;"
              loading="lazy"
            />
          </div>
        `,
      };
    });
  }, [pins, stickers]);

  // Renderizar pin con transición suave
  const renderPinWithTransition = useCallback((d: object) => {
    const pinData = d as PinData;
    const div = document.createElement("div");
    div.innerHTML = pinData.html;
    const element = div.firstElementChild as HTMLElement;
    if (element) {
      element.style.transition = "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)";
    }
    return element;
  }, []);

  // Detectar interacción en pines y mostrar tooltip
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      let target = e.target as Element | null;
      target = target?.closest?.("[data-pin-id]") ?? null;
      if (!target) return;

      const place = target.getAttribute("data-place") || "";
      const state = target.getAttribute("data-state") || "";
      const country = target.getAttribute("data-country") || "";
      const created = target.getAttribute("data-created") || "";

      let content = place;
      if (state) content += `, ${state}`;
      content += ` (${country})`;
      if (created) content += `\n${formatDate(created)}`;

      const rect = target.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        content,
      });
    };

    const handleMouseLeave = () => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const globeContainer = containerRef.current;
    if (globeContainer) {
      globeContainer.addEventListener("mouseenter", handleMouseEnter, true);
      globeContainer.addEventListener("mouseleave", handleMouseLeave, true);
    }

    return () => {
      if (globeContainer) {
        globeContainer.removeEventListener("mouseenter", handleMouseEnter, true);
        globeContainer.removeEventListener("mouseleave", handleMouseLeave, true);
      }
    };
  }, [formatDate]);

  // Calcular tamaño del contenedor
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    };

    const timer = setTimeout(updateSize, 0);
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Hacer el canvas completamente transparente (incluyendo renderer)
  useEffect(() => {
    const makeCanvasTransparent = () => {
      if (containerRef.current && globeEl.current) {
        const canvas = containerRef.current.querySelector("canvas");
        if (canvas) {
          canvas.style.background = "transparent";
          // Remover cualquier fondo pintado por el renderer
          const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
          if (ctx) {
            ctx.clearColor(0, 0, 0, 0);
          }
        }

        // Acceder al renderer de Three.js si es posible
        if (globeEl.current._renderer) {
          globeEl.current._renderer.setClearColor(0x000000, 0);
        }
      }
    };

    makeCanvasTransparent();
    const timer = setTimeout(makeCanvasTransparent, 50);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ pointerEvents: "auto" }}
    >
      <Globe
        ref={globeEl}
        width={containerSize.width || (typeof window !== "undefined" ? window.innerWidth : 800)}
        height={
          containerSize.height || (typeof window !== "undefined" ? window.innerHeight : 600)
        }
        globeImageUrl={GLOBE_IMAGE_URL}
        bumpImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
        showAtmosphere
        enablePointerInteraction
        globeTileEngineUrl={TILES_URL}
        htmlElementsData={htmlElements}
        htmlLat={(d) => (d as PinData).lat}
        htmlLng={(d) => (d as PinData).lng}
        htmlElement={renderPinWithTransition}
        onGlobeReady={() => {
          const globe = globeEl.current;
          if (!globe) return;
          const r = globe.getGlobeRadius();
          const controls = globe.controls();
          // Límite zoom out: el globo ocupa al menos ~1/3 de la pantalla
          controls.maxDistance = r * 4.5;
          // Límite zoom in: un poco más de acercamiento que el defecto (~r*1.01)
          controls.minDistance = r * 1.00055;
        }}
      />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed pointer-events-none z-50 bg-slate-900/95 text-white text-xs px-2.5 py-1.5 rounded border border-white/20 whitespace-pre"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: "translate(-50%, -100%)",
            backdropFilter: "blur(4px)",
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Attribution footer */}
      <div className="absolute bottom-4 right-4 text-xs text-white/50 select-none pointer-events-none">
        Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community
      </div>
    </div>
  );
}

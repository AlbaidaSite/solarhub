"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Globe from "react-globe.gl";
import { Plus } from "lucide-react";
import { getPinDetailAction } from "../actions";
import PinModal from "./PinModal";
import ClusterPopup from "./ClusterPopup";
import type { Pin, Sticker, PinDetail } from "@/types/map";

interface GlobeClientProps {
  pins: Pin[];
  stickers: Map<number, Sticker>;
}

interface PinData {
  id: string;
  lat: number;
  lng: number;
  html: string;
  isCluster: boolean;
  pinIds: number[];
  centerLat: number;
  centerLng: number;
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

const CLUSTER_EXPAND_THRESHOLD_DEG = 0.001;
const CLUSTER_ALTITUDE_FACTOR      = 0.025;
const CLUSTER_ALTITUDE_MIN         = 0.05;
const CLUSTER_TRANSITION_MS        = 1000;

function toRad(deg: number): number { return (deg * Math.PI) / 180; }
function toDeg(rad: number): number { return (rad * 180) / Math.PI; }

function greatCircleDistanceDeg(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dot =
    Math.sin(toRad(lat1)) * Math.sin(toRad(lat2)) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return toDeg(Math.acos(Math.max(-1, Math.min(1, dot))));
}

function sphericalCentroid(
  pts: ReadonlyArray<{ latitude: number; longitude: number }>
): { lat: number; lng: number } {
  let x = 0, y = 0, z = 0;
  for (const { latitude, longitude } of pts) {
    const lat = toRad(latitude), lng = toRad(longitude);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  const n = pts.length;
  x /= n; y /= n; z /= n;
  return {
    lng: toDeg(Math.atan2(y, x)),
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
  };
}

function angularExtentDeg(
  pts: ReadonlyArray<{ latitude: number; longitude: number }>
): number {
  let max = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = greatCircleDistanceDeg(
        pts[i].latitude, pts[i].longitude,
        pts[j].latitude, pts[j].longitude
      );
      if (d > max) max = d;
    }
  }
  return max;
}

export default function GlobeClient({ pins, stickers }: GlobeClientProps) {
  const router = useRouter();
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(2.5);
  const [modalDetail, setModalDetail] = useState<PinDetail | null>(null);
  const [clusterPopupPins, setClusterPopupPins] = useState<Pin[] | null>(null);
  const loadingPinIdRef = useRef<number | null>(null);

  // Formatear fecha
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Calcular radio de cluster en grados, dependiente de la altitud actual.
  // Más altitud (zoom out) ⇒ radio más amplio para agrupar pines lejanos.
  const clusterRadiusDeg = useMemo(() => {
    return Math.max(altitude * 4, 0.02);
  }, [altitude]);

  // Memoizar cálculo de elementos: cada elemento es o bien un pin individual
  // o un cluster de varios pines. El clustering recalcula cuando cambia la
  // altitud para que al hacer zoom in se separen los pines.
  const htmlElements: PinData[] = useMemo(() => {
    const result: PinData[] = [];
    const visited = new Set<number>();

    for (const pin of pins) {
      if (visited.has(pin.id)) continue;

      // Encontrar todos los pines dentro del radio de cluster
      const group = pins.filter(
        (p) =>
          !visited.has(p.id) &&
          Math.abs(p.latitude - pin.latitude) < clusterRadiusDeg &&
          Math.abs(p.longitude - pin.longitude) < clusterRadiusDeg
      );

      group.forEach((p) => visited.add(p.id));

      if (group.length === 1) {
        // Pin individual — el div externo es el que globe.gl posiciona con
        // translate(-50%,-50%), por lo que NO debe tener transforms propios.
        // El div interno es el que escala en hover.
        const sticker = stickers.get(pin.sticker_id);
        const iconUrl = sticker?.icon_path || "/cromos/locked.webp";
        result.push({
          id: `pin-${pin.id}`,
          lat: pin.latitude,
          lng: pin.longitude,
          isCluster: false,
          pinIds: [pin.id],
          centerLat: pin.latitude,
          centerLng: pin.longitude,
          html: `
            <div
              data-pin-id="${pin.id}"
              data-place="${pin.place}"
              data-state="${pin.state || ""}"
              data-country="${pin.country_code}"
              data-created="${pin.created_at}"
              style="width:${ICON_SIZE}px;height:${ICON_SIZE}px;pointer-events:auto;cursor:pointer;"
            >
              <div data-inner style="width:100%;height:100%;transition:transform 0.15s ease;transform-origin:center center;">
                <img
                  src="${iconUrl}"
                  alt="${pin.place}"
                  style="width:100%;height:100%;display:block;pointer-events:none;"
                  draggable="false"
                />
              </div>
            </div>
          `,
        });
      } else {
        // Cluster — mismo patrón: externo limpio, interno escalable
        const centerLat =
          group.reduce((sum, p) => sum + p.latitude, 0) / group.length;
        const centerLng =
          group.reduce((sum, p) => sum + p.longitude, 0) / group.length;
        const pinIds = group.map((p) => p.id);

        result.push({
          id: `cluster-${pinIds.join("-")}`,
          lat: centerLat,
          lng: centerLng,
          isCluster: true,
          pinIds,
          centerLat,
          centerLng,
          html: `
            <div
              data-cluster-pins="${pinIds.join(",")}"
              data-cluster-lat="${centerLat}"
              data-cluster-lng="${centerLng}"
              style="width:40px;height:40px;pointer-events:auto;cursor:pointer;"
            >
              <div data-inner style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.85);border:2px solid rgba(255,255,255,0.7);border-radius:9999px;box-shadow:0 2px 12px rgba(0,0,0,0.4);color:#18181b;font-weight:700;font-size:14px;transition:transform 0.15s ease;transform-origin:center center;">
                ${group.length}
              </div>
            </div>
          `,
        });
      }
    }

    return result;
  }, [pins, stickers, clusterRadiusDeg]);

  // Renderizar elemento del globo y añadir hover sobre el div interno,
  // sin tocar el div externo que globe.gl usa para posicionar con translate.
  const renderPinWithTransition = useCallback((d: object) => {
    const pinData = d as PinData;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = pinData.html.trim();
    const outer = wrapper.firstElementChild as HTMLElement;
    if (!outer) return outer;

    const inner = outer.querySelector<HTMLElement>("[data-inner]");
    if (inner) {
      const scale = pinData.isCluster ? "scale(1.12)" : "scale(1.25)";
      outer.addEventListener("mouseenter", () => {
        inner.style.transform = scale;
      });
      outer.addEventListener("mouseleave", () => {
        inner.style.transform = "scale(1)";
      });
    }

    return outer;
  }, []);

  // Helper: animar pointOfView hacia coordenadas con altitud nueva
  const flyTo = useCallback((lat: number, lng: number, newAltitude: number) => {
    const globe = globeEl.current;
    if (!globe) return;
    globe.pointOfView({ lat, lng, altitude: newAltitude }, 800);
  }, []);

  // Click en pin individual: cargar detalle, abrir modal y hacer zoom
  const handlePinClick = useCallback(
    async (pinId: number, lat: number, lng: number) => {
      // Evitar dobles cargas si el usuario hace clic varias veces seguidas
      if (loadingPinIdRef.current === pinId) return;
      loadingPinIdRef.current = pinId;

      // Zoom hacia el pin (no demasiado cerca para que no desaparezca el cluster contexto)
      const targetAltitude = Math.min(altitude, 0.001);
      flyTo(lat, lng, targetAltitude);

      try {
        const detail = await getPinDetailAction(pinId);
        if (detail && loadingPinIdRef.current === pinId) {
          setModalDetail(detail);
        }
      } finally {
        if (loadingPinIdRef.current === pinId) {
          loadingPinIdRef.current = null;
        }
      }
    },
    [altitude, flyTo]
  );

  // Click en cluster: mostrar popup si pines coincidentes o si el zoom-to-fit
  // supondría alejarse; hacer zoom-to-fit solo cuando resulta en acercamiento.
  const handleClusterClick = useCallback(
    (pinIds: number[]) => {
      const clusterPins = pinIds
        .map((id) => pins.find((p) => p.id === id))
        .filter((p): p is Pin => p !== undefined);
      if (clusterPins.length === 0) return;

      const extent = angularExtentDeg(clusterPins);

      if (extent < CLUSTER_EXPAND_THRESHOLD_DEG) {
        setClusterPopupPins(clusterPins);
        return;
      }

      const { lat, lng } = sphericalCentroid(clusterPins);
      const alt = Math.max(CLUSTER_ALTITUDE_MIN, extent * CLUSTER_ALTITUDE_FACTOR);

      // Nunca hacer zoom-out: si la altitud calculada no mejora la vista actual,
      // abrir el popup en lugar de alejar la cámara.
      if (alt >= altitude) {
        setClusterPopupPins(clusterPins);
        return;
      }

      globeEl.current?.pointOfView({ lat, lng, altitude: alt }, CLUSTER_TRANSITION_MS);
    },
    [pins, altitude]
  );

  // Detectar interacción en pines y mostrar tooltip + manejar clicks
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

    const handleClick = (e: MouseEvent) => {
      const targetEl = e.target as Element | null;

      // Click sobre cluster
      const clusterEl = targetEl?.closest?.("[data-cluster-pins]");
      if (clusterEl) {
        e.stopPropagation();
        const raw = clusterEl.getAttribute("data-cluster-pins") || "";
        const pinIds = raw.split(",").map(Number).filter(Boolean);
        handleClusterClick(pinIds);
        return;
      }

      // Click sobre pin individual
      const pinEl = targetEl?.closest?.("[data-pin-id]");
      if (pinEl) {
        e.stopPropagation();
        const pinId = parseInt(pinEl.getAttribute("data-pin-id") || "0", 10);
        const pin = pins.find((p) => p.id === pinId);
        if (pin) {
          setTooltip((prev) => ({ ...prev, visible: false }));
          handlePinClick(pinId, pin.latitude, pin.longitude);
        }
      }
    };

    // Los pines son elementos HTML que flotan sobre el canvas. Cuando el
    // cursor está sobre uno de ellos, los eventos wheel van al pin en lugar
    // de al canvas, por lo que OrbitControls no los recibe y el zoom deja
    // de funcionar. Este handler reenvía el wheel al canvas para que el
    // zoom siga activo independientemente de dónde esté el cursor.
    const handleWheel = (e: WheelEvent) => {
      const canvas = globeContainer?.querySelector<HTMLCanvasElement>("canvas");
      if (canvas && e.target !== canvas) {
        canvas.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: false,
            cancelable: e.cancelable,
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ,
            deltaMode: e.deltaMode,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            clientX: e.clientX,
            clientY: e.clientY,
          })
        );
      }
    };

    const globeContainer = containerRef.current;
    if (globeContainer) {
      globeContainer.addEventListener("mouseenter", handleMouseEnter, true);
      globeContainer.addEventListener("mouseleave", handleMouseLeave, true);
      globeContainer.addEventListener("click", handleClick, true);
      globeContainer.addEventListener("wheel", handleWheel, { passive: true });
    }

    return () => {
      if (globeContainer) {
        globeContainer.removeEventListener("mouseenter", handleMouseEnter, true);
        globeContainer.removeEventListener("mouseleave", handleMouseLeave, true);
        globeContainer.removeEventListener("click", handleClick, true);
        globeContainer.removeEventListener("wheel", handleWheel);
      }
    };
  }, [formatDate, handleClusterClick, handlePinClick, pins]);

  // Deshabilitar controles del globo cuando el popup de cluster está abierto
  useEffect(() => {
    const controls = globeEl.current?.controls?.();
    if (!controls) return;
    controls.enabled = clusterPopupPins === null;
  }, [clusterPopupPins]);

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
          // Inicializar altitud
          const pov = globe.pointOfView();
          setAltitude(pov.altitude);
        }}
        onZoom={(pov) => {
          // Throttle: solo actualizar si la altitud cambió significativamente
          setAltitude((prev) => {
            if (Math.abs(prev - pov.altitude) < 0.03) return prev;
            return pov.altitude;
          });
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

      {/* Añadir Pegatina button */}
      <button
        type="button"
        onClick={() => router.push("/mapa/nueva")}
        aria-label="Añadir Pegatina"
        title="Añadir Pegatina"
        className="absolute z-20 top-7 left-4 nav:top-28 nav:left-4 flex items-center justify-center gap-2 w-10 h-10 nav:w-auto nav:h-12 nav:px-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white hover:text-amber-300 transition-all duration-0 shadow-lg backdrop-blur-sm cursor-pointer"
      >
        <Plus size={20} strokeWidth={2.5} />
        <span className="hidden nav:inline text-sm font-semibold">Añadir Pegatina</span>
      </button>

      {/* Attribution footer */}
      <div className="absolute bottom-4 right-4 text-xs text-white/50 select-none pointer-events-none">
        Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community
      </div>

      {/* Modal de detalle del pin */}
      {modalDetail && (
        <PinModal detail={modalDetail} onClose={() => setModalDetail(null)} />
      )}

      {clusterPopupPins && (
        <ClusterPopup
          pins={clusterPopupPins}
          stickers={stickers}
          onSelectPin={(pinId, lat, lng) => {
            setClusterPopupPins(null);
            handlePinClick(pinId, lat, lng);
          }}
          onClose={() => setClusterPopupPins(null)}
        />
      )}
    </div>
  );
}

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

// Separación mínima en pantalla por debajo de la cual dos pines se agrupan.
// Coincide con el diámetro del círculo de cluster: por debajo de eso los
// iconos se solaparían de todas formas.
const CLUSTER_PX = 40;

// Fracción del alto del viewport que ocupa un cluster tras el zoom-to-fit.
// Con 0.6 los dos pines más lejanos del grupo acaban a ~60% de la pantalla,
// muy por encima de CLUSTER_PX, así que el grupo se rompe siempre.
const CLUSTER_FIT_FRACTION = 0.6;

const CLUSTER_TRANSITION_MS = 800;

// Altitud mínima alcanzable. pointOfView mide la altitud en radios de globo
// (distancia = R·(1+altitud)) y OrbitControls queda limitado a R·(1+MIN_ALTITUDE)
// en onGlobeReady. Si el zoom-to-fit de un cluster cae por debajo de este
// suelo no existe cámara capaz de separarlo, y entonces toca abrir el popup.
const MIN_ALTITUDE = 0.00055;

// FOV por defecto de la cámara de globe.gl, hasta que onGlobeReady lea el real.
const DEFAULT_FOV = 50;

// Los stickers crecen al acercarse. El motor de teselas elige el nivel Z con
// ceil(3 − log2(altitud)): sus umbrales son 8/2^i sobre exactamente la misma
// magnitud que la altitud de pointOfView, así que el nivel Z empieza cuando la
// altitud baja de 8/2^(Z−1). Z=8 ⇒ altitud 0.03125.
const PIN_GROW_START_LEVEL = 8;

// Ancho de la rampa en niveles de zoom: el crecimiento se reparte entre Z=9 y
// Z=12 en vez de dispararse de golpe al cruzar Z=9.
const PIN_GROW_SPAN_LEVELS = 3;

// Tamaño máximo de un sticker, como múltiplo de ICON_SIZE.
const PIN_MAX_SCALE = 1.75;

// Umbral del throttle de altitud, en logaritmo (≈5% de cambio relativo). Un
// umbral absoluto no sirve: cerca del suelo el rango útil es 0.00055–0.03, así
// que cualquier constante razonable congelaría el clustering al acercarse.
const ALTITUDE_LOG_EPSILON = 0.05;

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

// La cámara de globe.gl es perspectiva y apunta al centro del globo, así que un
// punto a `theta` grados del centro de vista se proyecta a:
//
//   px = k · sin(theta) / (1 + alt − cos(theta))     con k = (alto/2)/tan(fov/2)
//
// El radio del globo se cancela, por lo que `alt` es directamente la altitud
// que acepta pointOfView. Las dos funciones de abajo son las inversas exactas
// de esa relación y son la única fuente de verdad tanto para el radio de
// clustering como para la altitud de destino al abrir un cluster.

function projectionK(viewportHeight: number, fov: number): number {
  return viewportHeight / 2 / Math.tan(toRad(fov / 2));
}

// Altitud a la que dos puntos separados `thetaDeg` quedan a `targetPx`.
function altitudeForAngle(thetaDeg: number, targetPx: number, k: number): number {
  const t = toRad(thetaDeg);
  return (k * Math.sin(t)) / targetPx + Math.cos(t) - 1;
}

// Ángulo que a la altitud `alt` se proyecta como `targetPx`. Sale de resolver
// c·sinθ + cosθ = 1 + alt (con c = k/targetPx) como √(c²+1)·sin(θ+φ) = 1 + alt.
function angleForPixels(targetPx: number, alt: number, k: number): number {
  const c = k / targetPx;
  const ratio = (1 + alt) / Math.hypot(c, 1);
  // Solo se sale de rango con altitudes absurdas (alt > ~23): agrupar todo.
  if (ratio >= 1) return 180;
  return toDeg(Math.asin(ratio) - Math.atan2(1, c));
}

// Altitud a la que el motor de teselas entra en el nivel `level`.
function tileLevelAltitude(level: number): number {
  return 8 / 2 ** (level - 1);
}

// Escala de un sticker a una altitud dada: 1 hasta Z=9, y de ahí hasta
// PIN_MAX_SCALE a lo largo de PIN_GROW_SPAN_LEVELS niveles. El smoothstep deja
// la derivada a cero en ambos extremos, así que no se percibe ni el arranque
// del crecimiento al cruzar Z=9 ni el momento en que toca techo.
function pinScaleForAltitude(alt: number): number {
  if (!(alt > 0)) return 1;
  const levelsPast = Math.log2(tileLevelAltitude(PIN_GROW_START_LEVEL) / alt);
  const t = Math.min(1, Math.max(0, levelsPast / PIN_GROW_SPAN_LEVELS));
  return 1 + (PIN_MAX_SCALE - 1) * t * t * (3 - 2 * t);
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
  const [fov, setFov] = useState(DEFAULT_FOV);
  const [modalDetail, setModalDetail] = useState<PinDetail | null>(null);
  const [clusterPopupPins, setClusterPopupPins] = useState<Pin[] | null>(null);
  const loadingPinIdRef = useRef<number | null>(null);

  // Con un overlay abierto (detalle de pin o popup de cluster) el mapa
  // queda congelado: ni hover, ni clic, ni zoom, ni foco de teclado. Es
  // una sola bandera y no dos comprobaciones sueltas para que los tres
  // bloqueos no puedan desincronizarse.
  const overlayOpen = modalDetail !== null || clusterPopupPins !== null;

  // Formatear fecha
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // El clustering se define en píxeles de pantalla, no en grados: dos pines se
  // agrupan cuando el usuario no podría distinguirlos. El equivalente en grados
  // depende de la altitud y del viewport, así que se deriva de la proyección en
  // lugar de aproximarse con una constante.
  const viewportHeight =
    containerSize.height ||
    (typeof window !== "undefined" ? window.innerHeight : 600);
  const projK = useMemo(
    () => projectionK(viewportHeight, fov),
    [viewportHeight, fov]
  );
  // La separación mínima acompaña al tamaño del icono: si los stickers crecen y
  // el umbral se quedara en CLUSTER_PX, dos pines "separados" se solaparían.
  const clusterRadiusDeg = useMemo(
    () => angleForPixels(CLUSTER_PX * pinScaleForAltitude(altitude), altitude, projK),
    [altitude, projK]
  );

  // Memoizar cálculo de elementos: cada elemento es o bien un pin individual
  // o un cluster de varios pines. El clustering recalcula cuando cambia la
  // altitud para que al hacer zoom in se separen los pines.
  const htmlElements: PinData[] = useMemo(() => {
    const result: PinData[] = [];
    const visited = new Set<number>();

    for (const pin of pins) {
      if (visited.has(pin.id)) continue;

      // Pines dentro del radio, medido sobre la esfera y no como caja en
      // lat/lng: un grado de longitud mide la mitad a 60° de latitud, y la
      // caja agrupaba de más justo ahí.
      const group = pins.filter(
        (p) =>
          !visited.has(p.id) &&
          greatCircleDistanceDeg(
            pin.latitude, pin.longitude,
            p.latitude, p.longitude
          ) < clusterRadiusDeg
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
              <div data-inner style="width:100%;height:100%;transform:scale(var(--pin-zoom,1)) scale(var(--pin-hover,1));transition:transform 0.25s ease-out;transform-origin:center center;">
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
        // El mismo centroide esférico al que vuela handleClusterClick, para
        // que el círculo no se desplace bajo el cursor al abrirlo.
        const { lat: centerLat, lng: centerLng } = sphericalCentroid(group);
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
              <div data-inner style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.85);border:2px solid rgba(255,255,255,0.7);border-radius:9999px;box-shadow:0 2px 12px rgba(0,0,0,0.4);color:#18181b;font-weight:700;font-size:14px;transform:scale(var(--pin-hover,1));transition:transform 0.15s ease;transform-origin:center center;">
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
      // El hover va por variable y no sobrescribiendo `transform`: en los
      // stickers ese transform lleva además la escala de zoom, y asignarlo
      // entero la borraría hasta el siguiente movimiento de cámara.
      const hoverScale = pinData.isCluster ? "1.12" : "1.25";
      outer.addEventListener("mouseenter", () => {
        inner.style.setProperty("--pin-hover", hoverScale);
      });
      outer.addEventListener("mouseleave", () => {
        inner.style.setProperty("--pin-hover", "1");
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

  // Click en cluster: encuadrar el grupo entero en pantalla. A la altitud en la
  // que su extensión ocupa CLUSTER_FIT_FRACTION del alto, los dos pines más
  // lejanos quedan a cientos de píxeles — muy por encima de CLUSTER_PX — así que
  // el grupo se rompe siempre en al menos dos elementos, sin necesidad de buscar
  // la altitud por tanteo. Los subgrupos que sigan apretados quedan como
  // clusters más pequeños y se abren con otro clic, un nivel más abajo.
  const handleClusterClick = useCallback(
    (pinIds: number[]) => {
      const clusterPins = pinIds
        .map((id) => pins.find((p) => p.id === id))
        .filter((p): p is Pin => p !== undefined);
      if (clusterPins.length === 0) return;

      const extent = angularExtentDeg(clusterPins);

      // Dos altitudes distintas, y confundirlas manda al popup clusters que sí
      // se podían abrir: `altSplit` es la más alta a la que el grupo todavía se
      // rompe (extremos a CLUSTER_PX), y `altFit` la que además lo encuadra
      // holgadamente. altFit ≤ altSplit siempre, porque encuadrar exige más zoom
      // que separar.
      // Con el icono ya crecido: la pregunta es si se separarían pegando la
      // cámara al suelo, y ahí los stickers están a PIN_MAX_SCALE.
      const altSplit = altitudeForAngle(extent, CLUSTER_PX * PIN_MAX_SCALE, projK);
      const altFit = altitudeForAngle(
        extent,
        CLUSTER_FIT_FRACTION * viewportHeight,
        projK
      );

      // Solo el criterio de separación decide el popup: si ni pegando la cámara
      // al suelo se distinguirían, ningún vuelo ayuda y toca listarlos.
      if (altSplit < MIN_ALTITUDE) {
        setClusterPopupPins(clusterPins);
        return;
      }

      // Encuadre ideal, pero acotado por el suelo de la cámara (abajo) y por la
      // vista actual (arriba: un clic en un cluster nunca debe alejar). El suelo
      // sigue separando el grupo, porque altSplit ≥ MIN_ALTITUDE.
      const target = Math.min(Math.max(altFit, MIN_ALTITUDE), altitude);

      const { lat, lng } = sphericalCentroid(clusterPins);
      globeEl.current?.pointOfView(
        { lat, lng, altitude: target },
        CLUSTER_TRANSITION_MS
      );
    },
    [pins, altitude, viewportHeight, projK]
  );

  // Detectar interacción en pines y mostrar tooltip + manejar clicks
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      if (overlayOpen) return;
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
      if (overlayOpen) return;
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
      // Sin esta guarda, rodar la rueda sobre el modal (que se monta
      // dentro de este mismo contenedor, por lo que el evento burbujea
      // hasta aquí) reenviaba el wheel al canvas y el globo seguía
      // haciendo zoom por detrás.
      if (overlayOpen) return;
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
  }, [formatDate, handleClusterClick, handlePinClick, overlayOpen, pins]);

  // Congelar el globo mientras haya un overlay abierto: OrbitControls
  // gobierna arrastre, rueda y pellizco, así que con enabled=false no
  // queda ningún gesto capaz de mover ni acercar el mapa.
  useEffect(() => {
    const controls = globeEl.current?.controls?.();
    if (!controls) return;
    controls.enabled = !overlayOpen;
  }, [overlayOpen]);

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
      {/* Todo el mapa (globo, tooltip, botón de alta y créditos) queda
          `inert` mientras haya un overlay abierto: ningún elemento de
          aquí dentro puede recibir foco, clic ni ser anunciado por un
          lector de pantalla. `display: contents` hace que este div no
          genere caja, así que los hijos absolutos siguen posicionándose
          respecto al contenedor de arriba igual que antes. */}
      <div className="contents" inert={overlayOpen || undefined}>
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
            controls.minDistance = r * (1 + MIN_ALTITUDE);
            // Inicializar altitud
            const pov = globe.pointOfView();
            setAltitude(pov.altitude);
            containerRef.current?.style.setProperty(
              "--pin-zoom",
              pinScaleForAltitude(pov.altitude).toFixed(4)
            );
            // FOV real de la cámara: entra en el cálculo de píxeles por grado.
            const camFov = globe.camera()?.fov;
            if (camFov) setFov(camFov);
          }}
          onZoom={(pov) => {
            // La escala se escribe directo en el DOM, sin pasar por el estado:
            // OrbitControls emite este evento en cada frame (damping activo,
            // vuelos incluidos), así que el crecimiento sigue a la cámara. Con
            // el throttle de `altitude` de abajo se vería a escalones.
            containerRef.current?.style.setProperty(
              "--pin-zoom",
              pinScaleForAltitude(pov.altitude).toFixed(4)
            );

            // Throttle relativo: la altitud recorre tres órdenes de magnitud
            // (2.5 arriba, 0.00055 en el suelo), así que el umbral tiene que
            // ser proporcional o el clustering deja de recalcularse de cerca.
            setAltitude((prev) => {
              if (
                prev > 0 &&
                pov.altitude > 0 &&
                Math.abs(Math.log(prev / pov.altitude)) < ALTITUDE_LOG_EPSILON
              ) {
                return prev;
              }
              return pov.altitude;
            });
          }}
        />

        {/* Tooltip: se oculta también con un overlay abierto. No basta
            con el mouseleave del pin — al montarse el modal encima, el
            pin deja de recibir eventos y ese mouseleave nunca llega, así
            que el tooltip se quedaba flotando sobre el telón. */}
        {tooltip.visible && !overlayOpen && (
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
      </div>

      {/* Modal de detalle del pin */}
      {modalDetail && (
        <PinModal
          detail={modalDetail}
          onClose={() => setModalDetail(null)}
          onDelete={() => { setModalDetail(null); router.refresh(); }}
        />
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

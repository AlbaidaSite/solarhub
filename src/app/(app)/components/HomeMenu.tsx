"use client";

import { useState } from "react";
import Link from "next/link";
import ConstellationFigure from "./ConstellationFigure";
import { constellationBounds, constellationExtent } from "@/lib/constellation";
import { MENU_ITEMS } from "@/constants/navigation";

interface Placement {
  // Centro de la constelación, en % del escenario.
  left: number;
  top: number;
  // Giro 3D. Las constelaciones no miran de frente: cada una está tumbada
  // hacia un lado distinto, como si el cielo tuviera profundidad. Los
  // valores salen de la disposición de referencia y son puro ajuste
  // visual — se pueden tocar sin que nada más se entere.
  transform: string;
  // Multiplicador sobre el tamaño base, para que no parezcan calcadas.
  scale?: number;
  // Retoque fino del icono respecto al centro de las estrellas, en las
  // mismas unidades que los puntos (la caja mide unas 51). Negativo tira
  // a la izquierda y hacia arriba. Es para los iconos que no están
  // centrados en su propio lienzo y quedan descuadrados respecto a su
  // constelación aunque la caja sí coincida.
  iconOffsetX?: number;
  iconOffsetY?: number;
  // Retoque fino del tamaño del icono, multiplicando a ICON_SCALE. Los
  // dibujos no llenan por igual su lienzo —el planeta y el calendario
  // ocupan el suyo entero, la persona o la valla dejan aire de sobra—, así
  // que a igualdad de caja unos se ven más grandes que otros.
  iconScale?: number;
}

// Una entrada por elemento de MENU_ITEMS, EN SU MISMO ORDEN: Cromos arriba
// a la izquierda, Mapa arriba a la derecha, Perfil en el centro, Huerto
// abajo a la izquierda y Eventos abajo a la derecha. Si algún día se añade
// un sexto elemento al menú hay que darle sitio aquí; mientras tanto cae
// en FALLBACK_PLACEMENT, que lo deja abajo del todo, visible y sin taparse
// con ninguno de los cinco.
// El conjunto se reparte alrededor de Perfil, que va justo en el centro de
// la pantalla (left: 50): las otras cuatro cuelgan de ella en aspa.
const PLACEMENTS: Placement[] = [
  // Cromos — de canto, con el lado derecho hacia delante.
  {
    left: 27,
    top: 24,
    transform: "perspective(900px) rotateY(-38deg) rotateZ(-5deg)",
    iconOffsetX: -6,
  },
  // Mapa — el hexágono, ladeado y algo inclinado hacia atrás.
  {
    left: 71,
    top: 22,
    transform: "perspective(700px) rotateX(10deg) rotateY(-12deg) rotateZ(7deg)",
    iconScale: 0.85,
  },
  // Perfil — la más grande y la menos torcida: es la del centro.
  {
    left: 50,
    top: 52,
    transform: "perspective(800px) rotateY(-12deg) rotateZ(-7deg)",
    scale: 1.2,
    iconOffsetY: 0.5,
  },
  // Huerto — girada al revés que Cromos, para que no parezcan gemelas.
  { left: 21, top: 76, transform: "perspective(700px) rotateY(26deg) rotateZ(7deg)" },
  // Eventos — tumbada hacia atrás: el lado de arriba se aleja y queda
  // como un trapecio.
  {
    left: 77,
    top: 78,
    transform: "perspective(600px) rotateX(34deg) rotateZ(-2deg)",
    scale: 1.05,
    iconScale: 0.9,
    iconOffsetY: 1,
  },
];

const FALLBACK_PLACEMENT: Placement = { left: 50, top: 95, transform: "none", scale: 0.6 };

// Lado de cada constelación. Se acota por las dos dimensiones de la
// ventana: solo con vw, una pantalla ancha y baja las sacaría del
// escenario; solo con vh, una alta y estrecha las dejaría minúsculas.
const FIGURE_SIZE = "min(20vw, 30vh)";

// Cuánto crece el icono respecto a la constelación que tapa. Por encima
// de 1 se sale de ella, que es justo lo que se busca: al señalar, el icono
// manda sobre las estrellas apagadas de debajo. A partir de 1,7 los de los
// bordes empiezan a salirse de la pantalla.
const ICON_SCALE = 1.5;

// Alto de la franja superior donde aparece el nombre. Coincide con el
// pt-32 del <main> (ver (app)/layout.tsx), que es justo el hueco que ocupa
// el navbar en el resto de vistas.
const LABEL_BAND = "h-32";

export default function HomeMenu() {
  const [hovered, setHovered] = useState<number | null>(null);
  const extent = constellationExtent(MENU_ITEMS.map((item) => item.dots ?? []));

  // Salir de un elemento no apaga el nombre si el puntero ya ha entrado en
  // otro: al pasar de una constelación a otra los eventos llegan en ese
  // orden y el nombre parpadearía.
  const clearHover = (index: number) =>
    setHovered((current) => (current === index ? null : current));

  return (
    <>
      {/* Nombre de la sección señalada, en el sitio del navbar. Solo
          decorativo: cada enlace ya se anuncia con su propio nombre. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 hidden nav:flex ${LABEL_BAND} items-center justify-center px-6`}
      >
        <span
          className={`text-6xl font-bold tracking-wide text-white transition-opacity duration-200 ${
            hovered == null ? "opacity-0" : "opacity-100"
          }`}
        >
          {hovered == null ? "" : MENU_ITEMS[hovered].label}
        </span>
      </div>

      {/* ── Escritorio: el cielo ─────────────────────────────────────── */}
      <nav
        aria-label="Secciones (constelaciones)"
        className="relative hidden nav:block flex-1 min-h-0"
      >
        {MENU_ITEMS.map((item, index) => {
          const placement = PLACEMENTS[index] ?? FALLBACK_PLACEMENT;
          const isActive = hovered === index;
          const side = `calc(${FIGURE_SIZE} * ${placement.scale ?? 1})`;
          // El icono se planta sobre las estrellas —no sobre el centro de
          // la caja, que la constelación no tiene por qué ocupar entera— y
          // se estira hasta medir lo mismo que ellas. Todo en % del lado
          // de la caja, que es lo que abarca el viewBox.
          const bounds = constellationBounds(item.dots ?? []);
          const share = (value: number) => `${(value / (extent * 2)) * 100}%`;

          return (
            <Link
              key={item.label}
              href={item.href ?? "/"}
              aria-label={item.label}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => clearHover(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => clearHover(index)}
              className="absolute outline-none"
              style={{
                left: `${placement.left}%`,
                top: `${placement.top}%`,
                width: side,
                height: side,
                // El centrado va aquí y no en clases de Tailwind para no
                // pelearse con el giro 3D de dentro.
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="relative h-full w-full" style={{ transform: placement.transform }}>
                {/* Las estrellas no desaparecen bajo el icono, solo se
                    apagan: la constelación sigue leyéndose detrás. */}
                <ConstellationFigure
                  dots={item.dots ?? []}
                  extent={extent}
                  className={`h-full w-full drop-shadow-[0_0_6px_rgba(170,170,255,0.55)] transition-opacity duration-300 ${
                    isActive ? "opacity-40" : "opacity-100"
                  }`}
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                    isActive ? "opacity-100 scale-100" : "opacity-0 scale-75"
                  }`}
                  style={{
                    translate: `${share(bounds.centerX + (placement.iconOffsetX ?? 0))} ${share(
                      bounds.centerY + (placement.iconOffsetY ?? 0),
                    )}`,
                  }}
                >
                  {/* Al dar ancho y alto distintos el icono no se
                      deforma: su viewBox cuadrado se ajusta al lado menor
                      y queda centrado (preserveAspectRatio por defecto).
                      shrink-0 es imprescindible: es hijo de un flex, así
                      que en cuanto ICON_SCALE lo hace más ancho que la
                      caja, flex-shrink lo encoge de vuelta hasta ella y
                      subir la constante deja de tener efecto. */}
                  <item.icon
                    className="shrink-0 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
                    style={{
                      width: share(bounds.width * ICON_SCALE * (placement.iconScale ?? 1)),
                      height: share(bounds.height * ICON_SCALE * (placement.iconScale ?? 1)),
                    }}
                    strokeWidth={1}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Móvil: nada de constelaciones, los iconos a mano ──────────── */}
      <nav aria-label="Secciones" className="nav:hidden grid grid-cols-2 gap-4 py-2">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href ?? "/"}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-4 py-8 text-white/80 transition-colors hover:border-amber-300/50 hover:bg-white/10 hover:text-amber-300"
          >
            <item.icon size={48} strokeWidth={1.5} />
            <span className="text-lg font-bold">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  AMPLITUD_FOGONAZO,
  AMPLITUD_LATIDO,
  anchoFluido,
  BREAKPOINT_VISIBLE,
  cqw as cq,
  desplazamientoAversion,
  desplazamientoOjo,
  DURACION_FOGONAZO_S,
  DURACION_LATIDO_S,
  FACTOR_RECORRIDO,
  G,
  LLAMAS,
  ORIENTACION_SVG,
  SUAVIZADO,
  TAMANO_POR_DEFECTO,
  TIPO_CONTRAFASE,
  transformacionOrbita,
  type Desplazamiento,
} from "./geometria";

interface CiroProps {
  size?: number; // lado máximo del contenedor cuadrado en px
  className?: string;
}

const BASE_PATH = "/media/img/ciro";

const CLASE_FOGONAZO = "ciro-fogonazo";
const NOMBRE_FOGONAZO = "ciro-fogonazo"; // el `animationName` que llega en animationend

// Un campo de contraseña sigue siéndolo aunque el usuario haya pulsado el
// ojo de "mostrar contraseña" y su `type` haya pasado a "text": ambos
// formularios de acceso conservan el autocomplete (`current-password`,
// `new-password`), así que Ciro aparta la vista igual en los dos estados.
function esCampoContrasena(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  return el.type === "password" || el.autocomplete.includes("password");
}

export default function Ciro({ size = TAMANO_POR_DEFECTO, className = "" }: CiroProps) {
  const raizRef = useRef<HTMLDivElement>(null);
  const cuencaRef = useRef<HTMLDivElement>(null);
  const ojoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cuenca = cuencaRef.current;
    const ojo = ojoRef.current;
    if (!cuenca || !ojo) return;

    const mqVisible = window.matchMedia(`(min-width: ${BREAKPOINT_VISIBLE}px)`);
    const mqFino = window.matchMedia("(pointer: fine)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let centro = { x: 0, y: 0 };
    let tope = 0;
    // Última posición conocida del cursor, en px de viewport. null = fuera de
    // la ventana o sin puntero: el ojo se centra.
    let cursor: { x: number; y: number } | null = null;
    // Lado del campo de contraseña enfocado, o null si no hay ninguno. Manda
    // sobre el cursor mientras dura.
    let ladoApartado: number | null = null;
    let objetivo: Desplazamiento = { x: 0, y: 0 };
    let actual: Desplazamiento = { x: 0, y: 0 };
    let rafId: number | null = null;
    let detener: (() => void) | null = null;

    function medir() {
      const rectFondo = cuenca!.getBoundingClientRect();
      const rectOjo = ojo!.getBoundingClientRect();
      centro = {
        x: rectFondo.left + rectFondo.width / 2,
        y: rectFondo.top + rectFondo.height / 2,
      };
      tope = ((rectFondo.width - rectOjo.width) / 2) * FACTOR_RECORRIDO;
    }

    function escribir(v: Desplazamiento) {
      ojo!.style.translate = `${v.x}px ${v.y}px`;
    }

    function asentado() {
      return (
        Math.abs(objetivo.x - actual.x) < 0.15 && Math.abs(objetivo.y - actual.y) < 0.15
      );
    }

    function paso() {
      actual = {
        x: actual.x + (objetivo.x - actual.x) * SUAVIZADO,
        y: actual.y + (objetivo.y - actual.y) * SUAVIZADO,
      };

      if (asentado()) {
        actual = objetivo;
        escribir(actual);
        rafId = null;
        return;
      }

      escribir(actual);
      rafId = requestAnimationFrame(paso);
    }

    // El bucle solo existe mientras haya camino que recorrer: si ya está en
    // su sitio no se arranca, y `paso` se sale solo al llegar.
    function despertar() {
      if (rafId !== null || asentado()) return;
      rafId = requestAnimationFrame(paso);
    }

    function actualizarObjetivo() {
      if (ladoApartado !== null) {
        objetivo = desplazamientoAversion(ladoApartado, tope);
      } else if (cursor) {
        objetivo = desplazamientoOjo(cursor.x - centro.x, cursor.y - centro.y, tope);
      } else {
        objetivo = { x: 0, y: 0 };
      }
      despertar();
    }

    function onPointerMove(e: PointerEvent) {
      cursor = { x: e.clientX, y: e.clientY };
      actualizarObjetivo();
    }

    function onPointerLeave() {
      cursor = null;
      actualizarObjetivo();
    }

    // Al cambiar el tamaño o la posición en pantalla cambian centro y tope,
    // así que hay que rehacer el objetivo con la medida nueva.
    function remedir() {
      medir();
      actualizarObjetivo();
    }

    function onFocusIn(e: FocusEvent) {
      if (esCampoContrasena(e.target)) {
        const rect = e.target.getBoundingClientRect();
        ladoApartado = rect.left + rect.width / 2 - centro.x;
      } else {
        ladoApartado = null;
      }
      actualizarObjetivo();
    }

    // Al saltar de un campo a otro, `focusout` llega antes que `focusin`, así
    // que basta con limpiar aquí y dejar que `onFocusIn` vuelva a decidir.
    function onFocusOut() {
      ladoApartado = null;
      actualizarObjetivo();
    }

    function arrancar() {
      medir();

      // El seguimiento del cursor solo tiene sentido con puntero fino; la
      // aversión al campo de contraseña funciona también con pantalla táctil.
      const seguirCursor = mqFino.matches;
      if (seguirCursor) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", onPointerLeave);
      }
      window.addEventListener("resize", remedir);
      window.addEventListener("scroll", remedir, { passive: true });
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("focusout", onFocusOut);

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("resize", remedir);
        window.removeEventListener("scroll", remedir);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
        cursor = null;
        ladoApartado = null;
        objetivo = { x: 0, y: 0 };
        actual = { x: 0, y: 0 };
        ojo!.style.translate = "";
      };
    }

    function sincronizar() {
      const activo = mqVisible.matches && !mqReduce.matches;
      if (activo && !detener) {
        detener = arrancar();
      } else if (!activo && detener) {
        detener();
        detener = null;
      }
    }

    sincronizar();
    mqVisible.addEventListener("change", sincronizar);
    mqFino.addEventListener("change", sincronizar);
    mqReduce.addEventListener("change", sincronizar);

    return () => {
      mqVisible.removeEventListener("change", sincronizar);
      mqFino.removeEventListener("change", sincronizar);
      mqReduce.removeEventListener("change", sincronizar);
      detener?.();
      detener = null;
    };
  }, []);

  // El fogonazo se pone y se quita a mano en vez de con estado de React: así
  // un segundo clic durante la animación la reinicia (quitar clase → forzar
  // reflow → volver a ponerla), que con un re-render no pasaría.
  const fogonazo = () => {
    const raiz = raizRef.current;
    if (!raiz) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    raiz.classList.remove(CLASE_FOGONAZO);
    void raiz.offsetWidth;
    raiz.classList.add(CLASE_FOGONAZO);
  };

  // Retirada de la clase al acabar el tirón. Va como listener nativo y no
  // como prop onAnimationEnd porque el fogonazo se maneja entero fuera de
  // React (clases a mano), y así la limpieza vive junto al evento real.
  // Las 8 llamas terminan a la vez, con la primera que avise basta; el
  // latido es infinito, así que nunca emite animationend.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;

    const fin = (e: AnimationEvent) => {
      if (e.animationName === NOMBRE_FOGONAZO) raiz.classList.remove(CLASE_FOGONAZO);
    };

    raiz.addEventListener("animationend", fin);
    return () => raiz.removeEventListener("animationend", fin);
  }, []);

  // Lo estático (aspect-ratio, container-type, width: var(--ciro-lado)) vive
  // en la clase .ciro-raiz de globals.css; aquí solo van las variables.
  const raizStyle = {
    "--ciro-lado": anchoFluido(size),
    // Heredadas por las 8 llamas: mismo vaivén y misma duración para todas.
    "--ciro-amp": cq(AMPLITUD_LATIDO),
    "--ciro-dur": `${DURACION_LATIDO_S}s`,
    "--ciro-fog-amp": cq(AMPLITUD_FOGONAZO),
    "--ciro-fog-dur": `${DURACION_FOGONAZO_S}s`,
  } as CSSProperties;

  return (
    <div
      ref={raizRef}
      aria-hidden="true"
      className={`ciro-raiz relative pointer-events-none ${className}`}
      style={raizStyle}
    >
      {LLAMAS.map((llama, i) => {
        const dims = G[llama.tipo];
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: cq(dims.w),
              height: cq(dims.h),
              transform: transformacionOrbita(llama.angulo, cq(dims.r)),
            }}
          >
            <span
              className={`ciro-latido block w-full h-full ${
                llama.tipo === TIPO_CONTRAFASE ? "ciro-latido-contra" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- composición de SVGs estáticos, next/image no aporta nada aquí */}
              <img
                src={`${BASE_PATH}/${llama.tipo}.svg`}
                alt=""
                draggable={false}
                className="ciro-llama w-full h-full"
                style={{ rotate: `${-ORIENTACION_SVG[llama.tipo]}deg` }}
              />
            </span>
          </span>
        );
      })}

      <div
        ref={cuencaRef}
        className="absolute"
        style={{
          left: "50%",
          top: `calc(50% + ${cq(G.fondoDy)})`,
          width: cq(G.fondo),
          height: cq(G.fondo),
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- composición de SVGs estáticos, next/image no aporta nada aquí */}
        <img src={`${BASE_PATH}/fondo.svg`} alt="" draggable={false} className="absolute inset-0 w-full h-full" />

        <div
          ref={ojoRef}
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: cq(G.ojo),
            height: cq(G.ojo),
            transform: "translate(-50%, -50%)",
            willChange: "translate",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- composición de SVGs estáticos, next/image no aporta nada aquí */}
          <img src={`${BASE_PATH}/ojo.svg`} alt="" draggable={false} className="w-full h-full" />
        </div>
      </div>

      {/* La cara es lo único que recupera los clics (el contenedor entero es
          pointer-events-none para no estorbar al formulario): va encima de
          todo y cae en el centro del hueco, lejos de los campos. Es un
          adorno sin equivalente de teclado, así que se queda fuera del orden
          de tabulación y dentro del aria-hidden del contenedor. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- composición de SVGs estáticos, next/image no aporta nada aquí */}
      <img
        src={`${BASE_PATH}/cara.svg`}
        alt=""
        draggable={false}
        onClick={fogonazo}
        className="ciro-cara absolute pointer-events-auto cursor-pointer"
        style={{
          left: "50%",
          top: "50%",
          width: cq(G.cara),
          height: cq(G.cara),
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

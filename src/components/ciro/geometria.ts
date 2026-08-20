// Geometría de la mascota Ciro. Medida sobre las referencias de diseño en un
// lienzo de 812×812 px con el centro de la cara en (406, 406). Todo se
// expresa como fracción del lado del contenedor cuadrado, de modo que el
// conjunto entero escala solo: el componente traduce cada fracción a `cqw`
// (1% del lado del contenedor) y es el CSS quien reparte el tamaño real.
export const G = {
  cara: 0.397, // diámetro
  fondo: 0.268, // diámetro
  fondoDy: 0.044, // desplazamiento hacia abajo respecto al centro de la cara
  ojo: 0.1, // diámetro
  largo: { w: 0.11, h: 0.272, r: 0.345 }, // r = centro del conjunto → centro de la llama
  corto: { w: 0.122, h: 0.124, r: 0.245 },
} as const;

// Invariante de contención: el fondo queda íntegramente dentro de la cara
// (0.044 + 0.268/2 = 0.178 < 0.397/2 = 0.1985), así que nunca asoma por el
// borde del cuerpo.

// Orientación nativa de cada asset, en grados desde "arriba" y en sentido
// horario. corto.svg ya apunta a 45° (arriba-derecha) en el propio dibujo.
export const ORIENTACION_SVG = { largo: 0, corto: 45 } as const;

export const LLAMAS = [
  { tipo: "largo", angulo: 0 },
  { tipo: "largo", angulo: 90 },
  { tipo: "largo", angulo: 180 },
  { tipo: "largo", angulo: 270 },
  { tipo: "corto", angulo: 45 },
  { tipo: "corto", angulo: 135 },
  { tipo: "corto", angulo: 225 },
  { tipo: "corto", angulo: 315 },
] as const;

export const SATURACION = 340; // px de distancia del cursor a los que el ojo llega al tope
export const SUAVIZADO = 0.15; // interpolación por fotograma: 0 inmóvil, 1 sin suavizado
export const FACTOR_RECORRIDO = 1; // fracción del recorrido geométrico que se permite usar
export const AMPLITUD_LATIDO = 0.022; // amplitud del vaivén, como fracción del lado
// Medio ciclo del latido (ida o vuelta); único para las 8 llamas. Cuanto más
// corto, menos se demoran las llamas en los extremos del recorrido. Va de la
// mano de la curva de `.ciro-latido` en globals.css: un `ease-in-out` llega
// al extremo con velocidad 0 y parece que se para, así que allí se usa una
// bezier que cruza el punto de giro sin quedarse quieta.
export const DURACION_LATIDO_S = 2.4;

// Tipo de llama que late en contrafase: cuando las otras se acercan al
// cuerpo, estas se alejan. Mismo ciclo, arrancando por el extremo opuesto.
export const TIPO_CONTRAFASE = "corto";

// Tirón hacia fuera al hacer clic en Ciro, y lo que dura.
export const AMPLITUD_FOGONAZO = 0.06; // fracción del lado; ~3× el latido
export const DURACION_FOGONAZO_S = 0.55;

// Ángulo al que el ojo aparta la vista de un campo de contraseña, en grados
// sobre la horizontal: 45° = en diagonal hacia arriba.
export const ANGULO_AVERSION = 45;

// Ciro se ve siempre que se vea el divisor de la vista de acceso, que es
// `hidden md:flex` — 768px, el `md` por defecto de Tailwind. Si cambia uno,
// cambia el otro: por debajo de este ancho no se registran listeners porque
// no hay nada que mirar.
export const BREAKPOINT_VISIBLE = 768;

// Lado del contenedor cuando hay sitio de sobra. Es también el tope
// superior de anchoFluido.
export const TAMANO_POR_DEFECTO = 400;

// Sitio que hay que dejarle al formulario, en px desde el centro de la
// ventana. Como Ciro va centrado y sus llamas llegan casi al borde del
// contenedor, su ancho entero tiene que caber en 2 × (50vw − esta reserva).
// De ahí el `calc` de anchoFluido; subirla = encoger antes.
//
// El no-solape estricto sale a 320 = 384 (max-w-sm) − 64 (el pr-16/pl-16 de
// cada mitad). Se le restan 48 (24 de invasión por lado) porque lo que llega
// a esa altura es solo la punta afilada de una llama, no su caja: dejarle
// morder un poco el margen del formulario se nota mucho menos que tener a
// Ciro flotando en un hueco que le queda grande.
export const RESERVA_FORMULARIO = 250;

// Tope por alto de ventana, para que Ciro no desborde en pantallas apaisadas
// y bajas.
export const ANCHO_MAX_VH = 60;

export interface Desplazamiento {
  x: number;
  y: number;
}

/**
 * Ancho del conjunto: `size` como máximo, y siempre dentro del hueco libre
 * que queda entre los dos formularios, para que las llamas no se metan
 * encima de los campos. El alto sale solo por `aspect-ratio: 1`.
 */
export function anchoFluido(size: number): string {
  return `min(${size}px, calc(50vw - ${RESERVA_FORMULARIO}px), ${ANCHO_MAX_VH}vh)`;
}

/**
 * Traduce una fracción de G a `cqw` — 1% del lado del contenedor, que es
 * cuadrado. Es lo que permite que todo escale sin JS: el CSS decide el ancho
 * del conjunto y cada pieza se recalcula sola.
 * El redondeo evita arrastrar la basura del binario (0.022 * 100 =
 * 2.1999999999999997) hasta el DOM.
 */
export function cqw(fraccion: number): string {
  return `${+(fraccion * 100).toFixed(4)}cqw`;
}

/**
 * Desplazamiento del ojo respecto al centro del fondo.
 *
 * @param dx, dy  vector del centro del fondo al cursor, en px de viewport
 * @param tope    módulo máximo permitido, ya en px
 * @param saturacion  distancia a la que se alcanza `tope`
 *
 * Se acota el MÓDULO del vector, no una caja: por construcción es
 * geométricamente imposible que el resultado supere `tope`, así que el ojo
 * nunca puede salirse del círculo de fondo.
 */
export function desplazamientoOjo(
  dx: number,
  dy: number,
  tope: number,
  saturacion: number = SATURACION,
): Desplazamiento {
  const d = Math.hypot(dx, dy);
  if (d < 1 || tope <= 0) return { x: 0, y: 0 };

  const k = Math.min(1, d / saturacion);
  return {
    x: (dx / d) * tope * k,
    y: (dy / d) * tope * k,
  };
}

/**
 * Desplazamiento del ojo cuando aparta la vista de un campo de contraseña:
 * en diagonal hacia arriba y hacia el lado CONTRARIO al del campo, como si
 * no quisiera mirar lo que se escribe.
 *
 * @param ladoCampo  x del centro del campo menos x del centro del ojo. Si es
 *                   positivo (campo a la derecha) el ojo mira arriba-izquierda,
 *                   y al revés. Centrado o 0 → arriba-derecha.
 * @param tope       módulo máximo permitido, el mismo que usa el seguimiento
 *
 * El módulo es exactamente `tope`, así que la aversión tampoco puede sacar
 * el ojo del círculo.
 */
export function desplazamientoAversion(
  ladoCampo: number,
  tope: number,
): Desplazamiento {
  if (tope <= 0) return { x: 0, y: 0 };

  const rad = (ANGULO_AVERSION * Math.PI) / 180;
  const signo = ladoCampo > 0 ? -1 : 1;
  return {
    x: signo * Math.cos(rad) * tope,
    y: -Math.sin(rad) * tope,
  };
}

/**
 * Transformación CSS para colocar una llama en su órbita alrededor del
 * centro del conjunto: gira el sistema de coordenadas local y la aleja
 * radialmente. Todas las llamas comparten esta misma fórmula, solo cambian
 * `angulo` y `radio`.
 *
 * @param radio  distancia al centro, ya en unidades CSS (p. ej. "34.5cqw")
 */
export function transformacionOrbita(angulo: number, radio: string): string {
  return `translate(-50%, -50%) rotate(${angulo}deg) translateY(calc(-1 * ${radio}))`;
}

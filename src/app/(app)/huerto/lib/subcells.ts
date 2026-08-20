import type { GardenBed } from "@/types/garden";

// Un bancal ocupado se reparte entre sus cultivos. La dimensión que se
// divide es siempre la MAYOR, para que las subceldas queden lo más
// cuadradas posible: bancal ancho -> columnas, bancal alto -> filas.
//
// El empate (bancal cuadrado) con exactamente 2 cultivos es el único
// caso especial: se parte por la diagonal de abajo-izquierda a
// arriba-derecha en vez de por la mitad. Dos triángulos admiten un
// icono más grande que dos medias franjas (ver iconBoxForTriangle). Con
// 3 o más cultivos el corte diagonal no generaliza -- las franjas de
// los extremos serían astillas -- así que se vuelve a columnas.
export type SubcellLayout = "columns" | "rows" | "diagonal";

// Lado mínimo (en unidades de lienzo) que puede tener una subcelda al
// dividir un bancal. Añadir un cultivo que dejaría las subceldas por
// debajo de esto se rechaza: el icono ya no se distinguiría. 50 justo
// SÍ vale, por debajo no.
export const MIN_SUBCELL_SIZE = 50;

// Separación entre el contorno de un cultivo y el del bancal (y entre
// dos cultivos vecinos, que suman dos veces este margen).
const BED_MARGIN = 3;
// Separación adicional entre el icono y el contorno de su cultivo: el
// icono no debe tocar ningún borde.
const ICON_MARGIN = 6;

export interface IconBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Subcell {
  // Contorno del cultivo en coordenadas absolutas de lienzo (incluyen
  // pos_x/pos_y). Siempre un polígono -- un rectángulo son sus cuatro
  // vértices -- para que el consumidor dibuje franjas y triángulos con
  // el mismo <polygon> en vez de dos ramas distintas.
  points: [number, number][];
  // Caja donde el icono cabe entero sin tocar el contorno. SIEMPRE
  // cuadrada, aunque la subcelda no lo sea: el icono no debe estirarse
  // para llenar la celda, solo crecer todo lo que pueda conservando sus
  // proporciones. Dársela rectangular sería además frágil -- un SVG sin
  // viewBox no tiene proporción intrínseca, así que preserveAspectRatio
  // no tiene nada con lo que trabajar y se deformaría hasta los bordes
  // de la caja. En los triángulos es el mayor cuadrado inscrito.
  icon: IconBox;
}

export function layoutFor(bed: Pick<GardenBed, "width" | "height">, count: number): SubcellLayout {
  if (count === 2 && bed.width === bed.height) return "diagonal";
  return bed.width >= bed.height ? "columns" : "rows";
}

// Lado resultante al repartir el bancal entre `count` cultivos, medido
// sobre la dimensión que se divide. En el caso diagonal ninguna
// dimensión se parte, pero el cuadrado inscrito en cada triángulo mide
// justo la mitad del lado, así que dividir entre 2 da la misma cifra y
// no necesita rama propia.
export function subcellSizeFor(bed: Pick<GardenBed, "width" | "height">, count: number): number {
  if (count <= 0) return 0;
  return Math.max(bed.width, bed.height) === bed.width
    ? bed.width / count
    : bed.height / count;
}

// El primer cultivo de un bancal siempre cabe (no hay división): la
// regla solo mira qué pasaría al repartir entre uno más.
export function canAddCrop(bed: Pick<GardenBed, "width" | "height">, currentCount: number): boolean {
  if (currentCount === 0) return true;
  return subcellSizeFor(bed, currentCount + 1) >= MIN_SUBCELL_SIZE;
}

export function subcellsFor(bed: GardenBed, count: number): Subcell[] {
  if (count <= 0) return [];
  if (count === 1) return [rectSubcell(bed.pos_x, bed.pos_y, bed.width, bed.height)];

  if (layoutFor(bed, count) === "diagonal") return diagonalSubcells(bed);

  const cells: Subcell[] = [];
  if (layoutFor(bed, count) === "columns") {
    const width = bed.width / count;
    for (let i = 0; i < count; i++) {
      cells.push(rectSubcell(bed.pos_x + i * width, bed.pos_y, width, bed.height));
    }
  } else {
    const height = bed.height / count;
    for (let i = 0; i < count; i++) {
      cells.push(rectSubcell(bed.pos_x, bed.pos_y + i * height, bed.width, height));
    }
  }
  return cells;
}

// ─── Rectángulos ────────────────────────────────────────────────────

// Los márgenes se recortan a un cuarto del lado disponible: en un
// bancal diminuto un margen fijo se comería la celda entera (o la
// invertiría, dando anchos negativos).
function rectSubcell(x: number, y: number, width: number, height: number): Subcell {
  const inset = Math.min(BED_MARGIN, width / 4, height / 4);
  const rx = x + inset;
  const ry = y + inset;
  const rw = width - inset * 2;
  const rh = height - inset * 2;

  const iconInset = Math.min(ICON_MARGIN, rw / 4, rh / 4);
  // Cuadrado del lado de la dimensión MENOR, centrado: es lo más grande
  // que cabe sin tocar ningún borde ni deformarse. En una celda alargada
  // deja aire a los lados largos, que es justo lo que se busca -- el
  // icono no tiene que llenar la celda, la celda ya se ve por su color.
  const side = Math.min(rw - iconInset * 2, rh - iconInset * 2);

  return {
    points: [
      [rx, ry],
      [rx + rw, ry],
      [rx + rw, ry + rh],
      [rx, ry + rh],
    ],
    icon: {
      x: rx + (rw - side) / 2,
      y: ry + (rh - side) / 2,
      width: side,
      height: side,
    },
  };
}

// ─── Diagonal ───────────────────────────────────────────────────────

// Corte de abajo-izquierda a arriba-derecha. Deja dos triángulos
// rectángulos: el primero (orden 0) es el de arriba a la izquierda, con
// el ángulo recto en esa esquina; el segundo el de abajo a la derecha.
// Ese orden es el que se ve al arrastrar: soltar cerca de la esquina
// superior izquierda mete el cultivo en la posición 0.
function diagonalSubcells(bed: GardenBed): Subcell[] {
  const { pos_x: x, pos_y: y, width: w, height: h } = bed;

  return [
    triangleSubcell(x, y, w, h, "top-left"),
    triangleSubcell(x + w, y + h, w, h, "bottom-right"),
  ];
}

type RightAngleCorner = "top-left" | "bottom-right";

// Encoger un triángulo separándolo `margin` de sus TRES lados (los dos
// catetos y la hipotenusa) no es restar el margen a cada cateto: da un
// triángulo semejante, escalado por (r - margin) / r respecto al
// incentro, donde r es el inradio. El vértice del ángulo recto, al
// tener los dos catetos alineados con los ejes, simplemente se desplaza
// `margin` en cada eje hacia dentro.
function shrinkLegs(w: number, h: number, margin: number): { a: number; b: number } {
  const inradius = (w + h - Math.hypot(w, h)) / 2;
  const scale = inradius > 0 ? Math.max(0, (inradius - margin) / inradius) : 0;
  return { a: w * scale, b: h * scale };
}

// Mayor cuadrado con lados paralelos a los ejes que cabe en un
// triángulo rectángulo de catetos a y b: lado = a·b / (a + b), apoyado
// en el vértice del ángulo recto.
function inscribedSquareSide(a: number, b: number): number {
  return a + b > 0 ? (a * b) / (a + b) : 0;
}

function triangleSubcell(
  cornerX: number,
  cornerY: number,
  w: number,
  h: number,
  corner: RightAngleCorner,
): Subcell {
  // Signo con el que el triángulo crece desde su ángulo recto: el de
  // arriba a la izquierda se extiende hacia +x/+y, el de abajo a la
  // derecha hacia -x/-y.
  const dirX = corner === "top-left" ? 1 : -1;
  const dirY = corner === "top-left" ? 1 : -1;

  const outer = shrinkLegs(w, h, BED_MARGIN);
  const ox = cornerX + dirX * BED_MARGIN;
  const oy = cornerY + dirY * BED_MARGIN;

  const inner = shrinkLegs(w, h, BED_MARGIN + ICON_MARGIN);
  const ix = cornerX + dirX * (BED_MARGIN + ICON_MARGIN);
  const iy = cornerY + dirY * (BED_MARGIN + ICON_MARGIN);
  const side = inscribedSquareSide(inner.a, inner.b);

  return {
    points: [
      [ox, oy],
      [ox + dirX * outer.a, oy],
      [ox, oy + dirY * outer.b],
    ],
    icon: {
      // El cuadrado se apoya en el ángulo recto; hacia -x/-y hay que
      // restarle el lado para expresarlo como caja x/y/ancho/alto.
      x: dirX === 1 ? ix : ix - side,
      y: dirY === 1 ? iy : iy - side,
      width: side,
      height: side,
    },
  };
}

// Lienzo del huerto: rectángulo fijo que contiene todos los bancales,
// en unidades abstractas (no píxeles). Se fija como constante en vez
// de calcularse a partir del máximo de los bancales existentes: si el
// viewBox se recalculara dinámicamente, el dibujo entero se reescalaría
// cada vez que se añade un bancal, lo que se percibe como un fallo.
//
// Si el huerto real cambia de dimensiones, esta constante debería
// moverse a una tabla de configuración en vez de editarse aquí.
// Medidas reales del huerto (no píxeles, pero mantienen sus proporciones).
export const GARDEN_CANVAS = { width: 540, height: 810 } as const;

// Sangrado en cada lado para que el trazo de un bancal pegado al borde
// del lienzo (pos_x/pos_y = 0, o pos_x+width al máximo) no quede
// cortado a la mitad por el viewBox. Proporcional al lienzo en vez de
// una unidad fija, para que siga siendo un margen sensato si vuelve a
// cambiar de escala.
const CANVAS_BLEED = 4;
export const CANVAS_VIEWBOX = `${-CANVAS_BLEED} ${-CANVAS_BLEED} ${GARDEN_CANVAS.width + CANVAS_BLEED * 2} ${GARDEN_CANVAS.height + CANVAS_BLEED * 2}`;

// Compartido entre el marco del lienzo (GardenCanvas) y el contorno de
// cada bancal (BedShape) para que valgan siempre lo mismo.
export const BED_STROKE_WIDTH = 5;

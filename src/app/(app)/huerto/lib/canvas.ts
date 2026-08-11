// Lienzo del huerto: rectángulo fijo que contiene todos los bancales,
// en unidades abstractas (no píxeles). Se fija como constante en vez
// de calcularse a partir del máximo de los bancales existentes: si el
// viewBox se recalculara dinámicamente, el dibujo entero se reescalaría
// cada vez que se añade un bancal, lo que se percibe como un fallo.
//
// Si el huerto real cambia de dimensiones, esta constante debería
// moverse a una tabla de configuración en vez de editarse aquí.
export const GARDEN_CANVAS = { width: 100, height: 140 } as const;

// 1 unidad de sangrado en cada lado para que el trazo de un bancal
// pegado al borde del lienzo (pos_x/pos_y = 0, o pos_x+width al máximo)
// no quede cortado a la mitad por el viewBox.
export const CANVAS_VIEWBOX = `-1 -1 ${GARDEN_CANVAS.width + 2} ${GARDEN_CANVAS.height + 2}`;

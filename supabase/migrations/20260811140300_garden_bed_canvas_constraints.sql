-- =====================================================================
-- HUERTO: límites del lienzo de garden_bed
-- =====================================================================
-- garden_bed tiene width/height/pos_x/pos_y pero nada impedía tamaños o
-- posiciones sin sentido. El rectángulo que contiene el lienzo entero
-- (viewBox del SVG) es una constante en código -- ver GARDEN_CANVAS en
-- src/app/(app)/huerto/lib/canvas.ts -- no una columna de esta tabla:
-- así se puede redimensionar el huerto sin migración. Aquí solo se
-- protege que cada bancal individual tenga sentido geométrico.
-- =====================================================================

alter table public.garden_bed
  add constraint garden_bed_size_positive check (width > 0 and height > 0),
  add constraint garden_bed_pos_non_negative check (pos_x >= 0 and pos_y >= 0);

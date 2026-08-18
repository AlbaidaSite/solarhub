-- =====================================================================
-- CALENDARIO: "Mostrar solo a Loukous" activado por defecto
-- =====================================================================
-- El formulario de alta de eventos (NewEventForm.tsx) empieza a marcar
-- la casilla "Mostrar solo a Loukous" por defecto — se refleja también aquí
-- para cualquier inserción futura que no pase por el formulario. No
-- toca las filas ya existentes, solo el default de nuevas filas.
-- =====================================================================

alter table public.event alter column hide_external set default true;

-- =====================================================================
-- INTERCAMBIOS: faltaba la política de DELETE en trade
-- =====================================================================
-- public.trade tiene RLS activado desde
-- 20260601120000_enable_rls_remaining_tables.sql, pero solo se le creó
-- política de SELECT. Con RLS activo y sin política de DELETE, Postgres
-- no deja borrar ninguna fila... y no lo dice: un DELETE que no encaja
-- con ninguna política simplemente afecta a 0 filas, sin error. Por eso
-- cancelTradeAction devolvía ok, la interfaz quitaba el intercambio de
-- la lista, y al recargar seguía ahí — ni siquiera siendo staff.
--
-- Pueden borrar los dos participantes y staff, el mismo criterio que ya
-- usa trade_select_participant para verlo.
--
-- No hace falta política en trade_offer ni trade_unique: cuelgan de
-- trade con "on delete cascade" (ver initial_schema.sql) y el borrado en
-- cascada lo hace el propio motor, no el usuario, así que no pasa por
-- RLS.
-- =====================================================================

drop policy if exists trade_delete_participant on public.trade;

create policy trade_delete_participant
  on public.trade for delete to authenticated
  using (
    initiator_id = auth.uid()
    OR recipient_id = auth.uid()
    OR public.is_staff()
  );

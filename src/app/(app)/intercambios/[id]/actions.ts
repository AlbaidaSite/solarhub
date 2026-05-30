"use server";

import { requireUserActionClient } from "@/lib/supabase/actionAuth";

export type TradeDetailResult = { ok: true } | { ok: false; error: string };

export async function acceptTradeAction(tradeId: number): Promise<TradeDetailResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("trade_offer")
    .update({ is_accepted: true })
    .eq("trade_id", tradeId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unacceptTradeAction(tradeId: number): Promise<TradeDetailResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("trade_offer")
    .update({ is_accepted: false })
    .eq("trade_id", tradeId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Cromos propios disponibles para añadir a la oferta ──────────────────────

export interface OwnedCromoForTrade {
  cromoId: number;
  cromoName: string;
  thumbPath: string | null;
  uniques: Array<{ uniqueId: number; copyNumber: number }>;
}

type OwnedUniqueRow = {
  unique_cromo: {
    id: number;
    copy_number: number;
    cromo: { id: number; name: string; front_img: string } | null;
  } | null;
};

// No es una mutación: si no hay usuario logueado devolvemos [] para que el SSR
// del modal no rompa antes de redirigir al login.
export async function getUserOwnedCromosForTradeAction(
  tradeOfferId: number,
): Promise<OwnedCromoForTrade[]> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return [];
  const { supabase, userId } = auth;

  // Uniques ya presentes en esta oferta (para excluirlos)
  const { data: alreadyInOffer } = await supabase
    .from("trade_unique")
    .select("unique_id")
    .eq("trade_offer_id", tradeOfferId)
    .returns<Array<{ unique_id: number }>>();
  const alreadyIds = new Set((alreadyInOffer ?? []).map((r) => r.unique_id));

  // Uniques que el usuario posee ahora mismo, con info del cromo
  const { data: owned } = await supabase
    .from("unique_ownership")
    .select("unique_cromo!inner(id, copy_number, cromo:cromo_id(id, name, front_img))")
    .eq("user_id", userId)
    .eq("is_current_owner", true)
    .returns<OwnedUniqueRow[]>();

  const map = new Map<number, OwnedCromoForTrade>();
  for (const row of owned ?? []) {
    const uc = row.unique_cromo;
    if (!uc || alreadyIds.has(uc.id)) continue;
    const c = uc.cromo;
    if (!c) continue;
    if (!map.has(c.id)) {
      map.set(c.id, { cromoId: c.id, cromoName: c.name, thumbPath: c.front_img, uniques: [] });
    }
    map.get(c.id)!.uniques.push({ uniqueId: uc.id, copyNumber: uc.copy_number });
  }

  return [...map.values()].sort((a, b) => a.cromoName.localeCompare(b.cromoName, "es"));
}

export async function addUniqueToOfferAction(
  tradeOfferId: number,
  uniqueId: number,
): Promise<TradeDetailResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Verificar que el trade_offer pertenece al usuario
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("id", tradeOfferId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No autorizado." };

  const { error } = await supabase
    .from("trade_unique")
    .insert({ trade_offer_id: tradeOfferId, unique_id: uniqueId });

  if (error) return { ok: false, error: error.message };
  // El trigger trg_reset_acceptance resetea is_accepted automáticamente.
  return { ok: true };
}

export async function removeUniqueFromTradeAction(
  tradeOfferId: number,
  uniqueId: number,
): Promise<TradeDetailResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Verificar que el trade_offer pertenece al usuario actual
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("id", tradeOfferId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No autorizado." };

  const { error } = await supabase
    .from("trade_unique")
    .delete()
    .eq("trade_offer_id", tradeOfferId)
    .eq("unique_id", uniqueId);

  if (error) return { ok: false, error: error.message };
  // El trigger trg_reset_acceptance resetea is_accepted en todos los trade_offer del trade.
  return { ok: true };
}

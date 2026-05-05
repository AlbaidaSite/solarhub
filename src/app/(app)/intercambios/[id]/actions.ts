"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TradeDetailResult = { ok: true } | { ok: false; error: string };

export async function acceptTradeAction(tradeId: number): Promise<TradeDetailResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase
    .from("trade_offer")
    .update({ is_accepted: true })
    .eq("trade_id", tradeId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unacceptTradeAction(tradeId: number): Promise<TradeDetailResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase
    .from("trade_offer")
    .update({ is_accepted: false })
    .eq("trade_id", tradeId)
    .eq("user_id", user.id);

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

export async function getUserOwnedCromosForTradeAction(
  tradeOfferId: number,
): Promise<OwnedCromoForTrade[]> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Uniques ya presentes en esta oferta (para excluirlos)
  const { data: alreadyInOffer } = await supabase
    .from("trade_unique")
    .select("unique_id")
    .eq("trade_offer_id", tradeOfferId);
  const alreadyIds = new Set(
    ((alreadyInOffer ?? []) as Array<{ unique_id: number }>).map((r) => r.unique_id),
  );

  // Uniques que el usuario posee ahora mismo, con info del cromo
  const { data: owned } = await supabase
    .from("unique_ownership")
    .select("unique_cromo!inner(id, copy_number, cromo:cromo_id(id, name, front_img))")
    .eq("user_id", user.id)
    .eq("is_current_owner", true);

  const map = new Map<number, OwnedCromoForTrade>();
  for (const row of (owned ?? []) as unknown as Array<{
    unique_cromo: {
      id: number;
      copy_number: number;
      cromo: { id: number; name: string; front_img: string };
    };
  }>) {
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Verificar que el trade_offer pertenece al usuario
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("id", tradeOfferId)
    .eq("user_id", user.id)
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Verificar que el trade_offer pertenece al usuario actual
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("id", tradeOfferId)
    .eq("user_id", user.id)
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

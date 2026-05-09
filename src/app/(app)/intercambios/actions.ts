"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";

export type TradeActionResult = { ok: true; tradeId?: number } | { ok: false; error: string };

export async function startTradeAction(otherUserId: string): Promise<TradeActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };
  if (user.id === otherUserId) return { ok: false, error: "No puedes intercambiar contigo mismo." };

  // Defensa contra trades duplicados entre los mismos dos usuarios:
  // si ya existe uno abierto en cualquier dirección, lo reusamos.
  const { data: existing } = await supabase
    .from("trade")
    .select("id")
    .eq("is_mutual_agreement", false)
    .or(
      `and(initiator_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
      `and(initiator_id.eq.${otherUserId},recipient_id.eq.${user.id})`,
    )
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: true, tradeId: existing.id as number };
  }

  const { data: trade, error: tradeErr } = await supabase
    .from("trade")
    .insert({ initiator_id: user.id, recipient_id: otherUserId })
    .select("id")
    .single();
  if (tradeErr || !trade) return { ok: false, error: tradeErr?.message ?? "Error creando intercambio." };

  const tradeId = trade.id as number;

  // Crear trade_offer para cada participante
  const { error: offerErr } = await supabase.from("trade_offer").insert([
    { trade_id: tradeId, user_id: user.id },
    { trade_id: tradeId, user_id: otherUserId },
  ]);
  if (offerErr) {
    await supabase.from("trade").delete().eq("id", tradeId);
    return { ok: false, error: offerErr.message };
  }

  return { ok: true, tradeId };
}

// ─── Categorías (para el modal "Registrar y añadir" desde una oferta) ───────

export async function getCategoriesAction(): Promise<
  Array<{ id: number; name: string; icon_path: string; order_number: number }>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("category")
    .select("id, name, icon_path, order_number")
    .order("order_number", { ascending: true });
  return ((data ?? []) as Array<{
    id: number;
    name: string;
    icon_path: string;
    order_number: number;
  }>).map((c) => ({ ...c, icon_path: getStorageUrl(c.icon_path) }));
}

// ─── Context para el panel de intercambio del modal de cromo ─────────────────

export interface TradeContext {
  openTrades: Array<{ id: number; otherUserId: string; otherUsername: string }>;
  profiles:   Array<{ id: string; username: string }>;
}

export async function getTradeContextAction(): Promise<TradeContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { openTrades: [], profiles: [] };

  const [tradesRes, profilesRes] = await Promise.all([
    supabase
      .from("trade")
      .select("id, initiator:initiator_id(id, username), recipient:recipient_id(id, username)")
      .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("is_mutual_agreement", false),
    supabase
      .from("profile")
      .select("id, username")
      .neq("id", user.id)
      .order("username", { ascending: true }),
  ]);

  const openTrades = ((tradesRes.data ?? []) as unknown as Array<{
    id: number;
    initiator: { id: string; username: string } | null;
    recipient: { id: string; username: string } | null;
  }>).map((t) => {
    const isInitiator = t.initiator?.id === user.id;
    const other = isInitiator ? t.recipient : t.initiator;
    return {
      id: t.id,
      otherUserId: other?.id ?? "",
      otherUsername: other?.username ?? "—",
    };
  });

  return {
    openTrades,
    profiles: (profilesRes.data ?? []) as Array<{ id: string; username: string }>,
  };
}

// ─── Añadir un unique a la oferta propia de un trade ─────────────────────────

export async function addUniqueToMyTradeOfferAction(
  tradeId: number,
  uniqueId: number,
): Promise<TradeActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No eres parte de este intercambio." };

  const { error } = await supabase
    .from("trade_unique")
    .insert({ trade_offer_id: offer.id, unique_id: uniqueId });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Añadir un unique al trade buscándolo por (categoría, código) ────────────
// A diferencia de "Registrar y añadir", este flujo NO crea ownership: sólo
// verifica que el usuario actual ya es el dueño actual del unique y entonces
// lo añade a su oferta del trade.

const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

export type AddByCodeResult =
  | { ok: true; uniqueId: number; copyNumber: number; cromoName: string; thumbPath: string | null }
  | { ok: false; message: string };

export async function addUniqueByCodeToMyTradeOfferAction(
  tradeId: number,
  categoryId: number,
  code: number,
): Promise<AddByCodeResult> {
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Categoría inválida." };
  }
  if (!Number.isInteger(code) || code < SMALLINT_MIN || code > SMALLINT_MAX) {
    return { ok: false, message: "No existe ningún cromo con esa combinación." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión expirada." };

  // 1. Localizar el unique_cromo por (category, code).
  const { data: unique, error: findError } = await supabase
    .from("unique_cromo")
    .select("id, copy_number, cromo:cromo_id!inner(id, category_id, name, front_img)")
    .eq("code", code)
    .eq("cromo.category_id", categoryId)
    .limit(1)
    .maybeSingle();
  if (findError) return { ok: false, message: findError.message };
  if (!unique) return { ok: false, message: "No existe ningún cromo con esa combinación." };

  const uniqueRow = unique as unknown as {
    id: number;
    copy_number: number;
    cromo: { id: number; category_id: number; name: string; front_img: string | null };
  };
  const uniqueId = uniqueRow.id;

  // 2. Verificar que el usuario actual es el dueño actual del unique.
  const { data: ownership, error: ownError } = await supabase
    .from("unique_ownership")
    .select("id")
    .eq("unique_id", uniqueId)
    .eq("user_id", user.id)
    .eq("is_current_owner", true)
    .limit(1)
    .maybeSingle();
  if (ownError) return { ok: false, message: ownError.message };
  if (!ownership) return { ok: false, message: "No eres el dueño actual de este cromo." };

  // 3. Localizar la oferta del usuario en este trade.
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!offer) return { ok: false, message: "No eres parte de este intercambio." };

  // 4. Evitar duplicados: si ya está añadido, no es error pero tampoco insertamos.
  const { data: existing } = await supabase
    .from("trade_unique")
    .select("unique_id")
    .eq("trade_offer_id", offer.id)
    .eq("unique_id", uniqueId)
    .maybeSingle();
  if (existing) return { ok: false, message: "Ese cromo ya está en tu oferta." };

  const { error: insertError } = await supabase
    .from("trade_unique")
    .insert({ trade_offer_id: offer.id, unique_id: uniqueId });
  if (insertError) {
    const msg = insertError.message;
    if (msg.includes("trade_unique_pkey"))
      return { ok: false, message: "Algún cromo de los seleccionados ya está en este intercambio." };
    if (msg.includes("comprometido"))
      return { ok: false, message: "Algún cromo de los seleccionados ya está comprometido en otro intercambio activo." };
    return { ok: false, message: msg };
  }

  return {
    ok: true,
    uniqueId,
    copyNumber: uniqueRow.copy_number,
    cromoName: uniqueRow.cromo.name,
    thumbPath: uniqueRow.cromo.front_img ?? null,
  };
}

export async function cancelTradeAction(tradeId: number): Promise<TradeActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Verificar que el usuario es parte del trade
  const { data: trade } = await supabase
    .from("trade")
    .select("id")
    .eq("id", tradeId)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .maybeSingle();
  if (!trade) return { ok: false, error: "Intercambio no encontrado." };

  const { error } = await supabase.from("trade").delete().eq("id", tradeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

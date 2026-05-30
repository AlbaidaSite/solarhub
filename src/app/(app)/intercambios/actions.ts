"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl } from "@/lib/supabase/storage";
import {
  isNumber,
  isRpcFailure,
  isRpcSuccessWith,
} from "@/lib/supabase/rpcResult";

export type TradeActionResult = { ok: true; tradeId?: number } | { ok: false; error: string };

// Crear (o reusar) un trade abierto entre dos usuarios. La lógica de
// lookup + insert trade + insert 2 trade_offer vive ahora en la RPC
// `start_trade`, que envuelve todo en una transacción atómica.
export async function startTradeAction(otherUserId: string): Promise<TradeActionResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("start_trade", {
    p_other_user_id: otherUserId,
  });

  if (error) return { ok: false, error: error.message };
  if (isRpcFailure(data)) return { ok: false, error: data.error };
  if (!isRpcSuccessWith(data, "trade_id", isNumber)) {
    return { ok: false, error: "Respuesta inesperada al crear intercambio." };
  }

  return { ok: true, tradeId: data.trade_id };
}

// ─── Categorías (para el modal "Registrar y añadir" desde una oferta) ───────

export async function getCategoriesAction(): Promise<
  Array<{ id: number; name: string; icon_path: string; order_number: number }>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("category")
    .select("id, name, icon_path, order_number")
    .order("order_number", { ascending: true })
    .returns<Array<{ id: number; name: string; icon_path: string; order_number: number }>>();
  return (data ?? []).map((c) => ({ ...c, icon_path: getStorageUrl(c.icon_path) }));
}

// ─── Context para el panel de intercambio del modal de cromo ─────────────────

export interface TradeContext {
  openTrades: Array<{ id: number; otherUserId: string; otherUsername: string }>;
  profiles:   Array<{ id: string; username: string }>;
}

type TradeRow = {
  id: number;
  initiator: { id: string; username: string } | null;
  recipient: { id: string; username: string } | null;
};

// No es una mutación: si no hay usuario logueado devolvemos listas vacías en
// lugar de error para que el SSR del álbum no rompa.
export async function getTradeContextAction(): Promise<TradeContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { openTrades: [], profiles: [] };

  const [tradesRes, profilesRes] = await Promise.all([
    supabase
      .from("trade")
      .select("id, initiator:initiator_id(id, username), recipient:recipient_id(id, username)")
      .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("is_mutual_agreement", false)
      .returns<TradeRow[]>(),
    supabase
      .from("profile")
      .select("id, username")
      .neq("id", user.id)
      .order("username", { ascending: true })
      .returns<Array<{ id: string; username: string }>>(),
  ]);

  const openTrades = (tradesRes.data ?? []).map((t) => {
    const isInitiator = t.initiator?.id === user.id;
    const other = isInitiator ? t.recipient : t.initiator;
    return {
      id: t.id,
      otherUserId: other?.id ?? "",
      otherUsername: other?.username ?? "—",
    };
  });

  return { openTrades, profiles: profilesRes.data ?? [] };
}

// ─── Añadir un unique a la oferta propia de un trade ─────────────────────────

export async function addUniqueToMyTradeOfferAction(
  tradeId: number,
  uniqueId: number,
): Promise<TradeActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("user_id", userId)
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

// unique_cromo.code se almacena como smallint (16 bits con signo) en Postgres.
const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

const CROMO_NOT_FOUND_MSG = "No existe ningún cromo con esa combinación.";

export type AddByCodeResult =
  | { ok: true; uniqueId: number; copyNumber: number; cromoName: string; thumbPath: string | null }
  | { ok: false; error: string };

type UniqueByCodeRow = {
  id: number;
  copy_number: number;
  cromo: { id: number; category_id: number; name: string; front_img: string | null };
};

export async function addUniqueByCodeToMyTradeOfferAction(
  tradeId: number,
  categoryId: number,
  code: number,
): Promise<AddByCodeResult> {
  const errors: string[] = [];
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.push("Categoría inválida.");
  }
  if (!Number.isInteger(code) || code < SMALLINT_MIN || code > SMALLINT_MAX) {
    errors.push(CROMO_NOT_FOUND_MSG);
  }
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };

  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // 1. Localizar el unique_cromo por (category, code).
  const { data: unique, error: findError } = await supabase
    .from("unique_cromo")
    .select("id, copy_number, cromo:cromo_id!inner(id, category_id, name, front_img)")
    .eq("code", code)
    .eq("cromo.category_id", categoryId)
    .limit(1)
    .maybeSingle<UniqueByCodeRow>();
  if (findError) return { ok: false, error: findError.message };
  if (!unique) return { ok: false, error: CROMO_NOT_FOUND_MSG };

  // 2. Verificar que el usuario actual es el dueño actual del unique.
  const { data: ownership, error: ownError } = await supabase
    .from("unique_ownership")
    .select("id")
    .eq("unique_id", unique.id)
    .eq("user_id", userId)
    .eq("is_current_owner", true)
    .limit(1)
    .maybeSingle();
  if (ownError) return { ok: false, error: ownError.message };
  if (!ownership) return { ok: false, error: "No eres el dueño actual de este cromo." };

  // 3. Localizar la oferta del usuario en este trade.
  const { data: offer } = await supabase
    .from("trade_offer")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No eres parte de este intercambio." };

  // 4. Evitar duplicados: si ya está añadido, no es error pero tampoco insertamos.
  const { data: existing } = await supabase
    .from("trade_unique")
    .select("unique_id")
    .eq("trade_offer_id", offer.id)
    .eq("unique_id", unique.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ese cromo ya está en tu oferta." };

  const { error: insertError } = await supabase
    .from("trade_unique")
    .insert({ trade_offer_id: offer.id, unique_id: unique.id });
  if (insertError) {
    const msg = insertError.message;
    if (msg.includes("trade_unique_pkey"))
      return { ok: false, error: "Algún cromo de los seleccionados ya está en este intercambio." };
    if (msg.includes("comprometido"))
      return { ok: false, error: "Algún cromo de los seleccionados ya está comprometido en otro intercambio activo." };
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    uniqueId: unique.id,
    copyNumber: unique.copy_number,
    cromoName: unique.cromo.name,
    thumbPath: unique.cromo.front_img ?? null,
  };
}

export async function cancelTradeAction(tradeId: number): Promise<TradeActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Verificar que el usuario es parte del trade
  const { data: trade } = await supabase
    .from("trade")
    .select("id")
    .eq("id", tradeId)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .maybeSingle();
  if (!trade) return { ok: false, error: "Intercambio no encontrado." };

  const { error } = await supabase.from("trade").delete().eq("id", tradeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Cubre los puntos de la lógica de trades que viven en triggers/constraints
// y que la suite mockeada no podía verificar:
//
//   · RF-018: trg_reset_acceptance resetea aceptaciones al cambiar trade_unique.
//   · RF-020: trg_complete_trade_on_mutual_acceptance cierra el trade y
//             hace el swap de current_owner cuando ambos aceptan.
//   · RN-014: CHECK (initiator_id <> recipient_id).
//   · trg_unique_not_in_active_trade: un unique en un solo trade activo.
//   · RN-016 (gap G3): el cierre no comprueba propiedad actual.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createTestCromo,
  createTestUser,
  setCurrentOwner,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

// Helper local: crea trade abierto entre A y B y devuelve sus ids útiles.
async function openTrade(initiatorId: string, recipientId: string) {
  const admin = createAdminClient();
  const { data: trade, error: tErr } = await admin
    .from("trade")
    .insert({ initiator_id: initiatorId, recipient_id: recipientId })
    .select("id")
    .single();
  if (tErr || !trade) throw new Error(`open trade: ${tErr?.message}`);

  const { data: offers, error: oErr } = await admin
    .from("trade_offer")
    .insert([
      { trade_id: trade.id, user_id: initiatorId },
      { trade_id: trade.id, user_id: recipientId },
    ])
    .select("id, user_id");
  if (oErr || !offers) throw new Error(`open trade offers: ${oErr?.message}`);

  return {
    tradeId: trade.id as number,
    initiatorOfferId: (offers.find((o) => o.user_id === initiatorId)!.id) as number,
    recipientOfferId: (offers.find((o) => o.user_id === recipientId)!.id) as number,
  };
}

describe.skipIf(!supabaseUp)(
  `Trades (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("RN-014 · CHECK de Postgres rechaza un trade consigo mismo", async () => {
      const admin = createAdminClient();
      const user = await createTestUser();
      const { error } = await admin
        .from("trade")
        .insert({ initiator_id: user.id, recipient_id: user.id });
      expect(error).not.toBeNull();
    });

    it("RF-018 · al retirar una copia, trg_reset_acceptance desactiva ambas ofertas", async () => {
      const admin = createAdminClient();
      const cromo = await createTestCromo({ copies: 2 });
      const userA = await createTestUser();
      const userB = await createTestUser();
      await setCurrentOwner(cromo.uniques[0].id, userA.id);

      const { tradeId, initiatorOfferId, recipientOfferId } = await openTrade(
        userA.id,
        userB.id,
      );

      // A añade un unique a su oferta.
      await admin.from("trade_unique").insert({
        trade_offer_id: initiatorOfferId,
        unique_id: cromo.uniques[0].id,
      });
      // Ambos aceptan.
      await admin
        .from("trade_offer")
        .update({ is_accepted: true })
        .eq("trade_id", tradeId);

      // Retira la copia → el trigger debería resetear ambas aceptaciones.
      await admin
        .from("trade_unique")
        .delete()
        .eq("trade_offer_id", initiatorOfferId)
        .eq("unique_id", cromo.uniques[0].id);

      const { data: offers } = await admin
        .from("trade_offer")
        .select("id, is_accepted")
        .eq("trade_id", tradeId);
      const acceptedSet = new Set((offers ?? []).map((o) => o.is_accepted));
      expect(acceptedSet).toEqual(new Set([false]));
      void recipientOfferId;
    });

    it("RF-020 · cuando ambos aceptan, trg_complete_trade marca mutual_agreement y swap de ownership", async () => {
      const admin = createAdminClient();
      const cromoA = await createTestCromo();
      const cromoB = await createTestCromo();
      const userA = await createTestUser();
      const userB = await createTestUser();
      await setCurrentOwner(cromoA.uniques[0].id, userA.id);
      await setCurrentOwner(cromoB.uniques[0].id, userB.id);

      const { tradeId, initiatorOfferId, recipientOfferId } = await openTrade(
        userA.id,
        userB.id,
      );

      await admin.from("trade_unique").insert([
        { trade_offer_id: initiatorOfferId, unique_id: cromoA.uniques[0].id },
        { trade_offer_id: recipientOfferId, unique_id: cromoB.uniques[0].id },
      ]);
      // Aceptación cruzada: primero recipient, luego initiator (el trigger
      // dispara en la transición a true del SEGUNDO).
      await admin
        .from("trade_offer")
        .update({ is_accepted: true })
        .eq("id", recipientOfferId);
      await admin
        .from("trade_offer")
        .update({ is_accepted: true })
        .eq("id", initiatorOfferId);

      // 1. Trade marcado como cerrado.
      const { data: trade } = await admin
        .from("trade")
        .select("is_mutual_agreement")
        .eq("id", tradeId)
        .single();
      expect(trade?.is_mutual_agreement).toBe(true);

      // 2. Ownership ha cruzado: A pasa a B y viceversa.
      const { data: aNow } = await admin
        .from("unique_ownership")
        .select("user_id")
        .eq("unique_id", cromoA.uniques[0].id)
        .eq("is_current_owner", true)
        .maybeSingle();
      expect(aNow?.user_id).toBe(userB.id);

      const { data: bNow } = await admin
        .from("unique_ownership")
        .select("user_id")
        .eq("unique_id", cromoB.uniques[0].id)
        .eq("is_current_owner", true)
        .maybeSingle();
      expect(bNow?.user_id).toBe(userA.id);

      // 3. RN-011 cumplido: los owners viejos siguen en el historial.
      const { data: aHist } = await admin
        .from("unique_ownership")
        .select("user_id, is_current_owner")
        .eq("unique_id", cromoA.uniques[0].id);
      expect((aHist ?? []).length).toBeGreaterThanOrEqual(2);
      const aOld = (aHist ?? []).find(
        (r) => r.user_id === userA.id && r.is_current_owner === false,
      );
      expect(aOld).toBeTruthy();
    });

    it("trg_unique_not_in_active_trade · un unique no puede estar en dos trades activos a la vez", async () => {
      const admin = createAdminClient();
      const cromo = await createTestCromo();
      const userA = await createTestUser();
      const userB = await createTestUser();
      const userC = await createTestUser();
      await setCurrentOwner(cromo.uniques[0].id, userA.id);

      const t1 = await openTrade(userA.id, userB.id);
      await admin.from("trade_unique").insert({
        trade_offer_id: t1.initiatorOfferId,
        unique_id: cromo.uniques[0].id,
      });

      // 2º trade abierto (A↔C). Intentar añadir el MISMO unique → bloqueado.
      const t2 = await openTrade(userA.id, userC.id);
      const { error } = await admin.from("trade_unique").insert({
        trade_offer_id: t2.initiatorOfferId,
        unique_id: cromo.uniques[0].id,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("comprometido");
    });

    it("RN-016 (gap G3) · el cierre NO comprueba propiedad actual; transfiere igual aunque el ofertante ya no sea owner", async () => {
      // Reproduce el gap: A añade copia → el ownership cambia por otra vía
      // (aquí lo simulamos transfiriendo a un tercero) → ambos aceptan →
      // el trigger transfiere igual. Si en el futuro se añade validación
      // de current_owner en el cierre, este test debe pasar a fallar (la
      // transferencia debería bloquearse) y se documentaría el cambio.
      const admin = createAdminClient();
      const cromo = await createTestCromo({ allowMultipleUsers: true }); // habilitamos múltiples para no chocar con RN-010 al mover ownership
      const userA = await createTestUser();
      const userB = await createTestUser();
      const userC = await createTestUser();
      await setCurrentOwner(cromo.uniques[0].id, userA.id);

      const { tradeId, initiatorOfferId } = await openTrade(userA.id, userB.id);
      await admin.from("trade_unique").insert({
        trade_offer_id: initiatorOfferId,
        unique_id: cromo.uniques[0].id,
      });

      // Movemos el ownership a C (A deja de ser owner actual). Con
      // allow_multiple_users=true podemos mantener varias entradas current.
      await admin
        .from("unique_ownership")
        .update({ is_current_owner: false })
        .eq("unique_id", cromo.uniques[0].id)
        .eq("user_id", userA.id);
      await admin.from("unique_ownership").insert({
        unique_id: cromo.uniques[0].id,
        user_id: userC.id,
        is_current_owner: true,
      });

      // Ambos aceptan el trade.
      await admin
        .from("trade_offer")
        .update({ is_accepted: true })
        .eq("trade_id", tradeId);

      // El trigger ha cerrado el trade igualmente (GAP G3).
      const { data: trade } = await admin
        .from("trade")
        .select("is_mutual_agreement")
        .eq("id", tradeId)
        .single();
      expect(trade?.is_mutual_agreement).toBe(true);

      // Y ha insertado una entrada como current_owner para B también
      // (creando un estado inconsistente: A no era owner pero B "recibe").
      const { data: bRows } = await admin
        .from("unique_ownership")
        .select("user_id, is_current_owner")
        .eq("unique_id", cromo.uniques[0].id)
        .eq("user_id", userB.id);
      const bIsCurrent = (bRows ?? []).some((r) => r.is_current_owner === true);
      expect(bIsCurrent).toBe(true);
    });
  },
);

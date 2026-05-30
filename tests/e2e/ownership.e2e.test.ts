// Cubre RN-010 (single current owner por copia) y documenta el gap G2 de
// RN-011 (preservación de `date_acquired` original al recuperar). Trabaja
// directamente sobre `unique_ownership` con el cliente admin para verificar
// el trigger `trg_validate_single_current_owner`.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createTestCromo,
  createTestUser,
  setCurrentOwner,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

describe.skipIf(!supabaseUp)(
  `RN-010 / RN-011 · ownership (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("RN-010 · sin allow_multiple_users, el trigger rechaza un segundo current_owner para la misma copia", async () => {
      const admin = createAdminClient();
      const cromo = await createTestCromo({ allowMultipleUsers: false });
      const userA = await createTestUser();
      const userB = await createTestUser();

      const uniqueId = cromo.uniques[0].id;
      await setCurrentOwner(uniqueId, userA.id);

      // Intento añadir B como current_owner sin cerrar A → debe fallar.
      const { error } = await admin.from("unique_ownership").insert({
        unique_id: uniqueId,
        user_id: userB.id,
        is_current_owner: true,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("dueño actual");
    });

    it("RN-010 · con allow_multiple_users=true, dos usuarios pueden ser current_owner simultáneamente", async () => {
      const cromo = await createTestCromo({ allowMultipleUsers: true });
      const userA = await createTestUser();
      const userB = await createTestUser();

      const uniqueId = cromo.uniques[0].id;
      await setCurrentOwner(uniqueId, userA.id);

      // Insertamos B sin cerrar A. Como allow_multiple_users=true, OK.
      const admin = createAdminClient();
      const { error } = await admin.from("unique_ownership").insert({
        unique_id: uniqueId,
        user_id: userB.id,
        is_current_owner: true,
      });
      expect(error).toBeNull();

      // Verificamos: dos filas current_owner=true para el mismo unique.
      const { data: owners } = await admin
        .from("unique_ownership")
        .select("user_id")
        .eq("unique_id", uniqueId)
        .eq("is_current_owner", true);
      const ids = new Set((owners ?? []).map((o) => o.user_id as string));
      expect(ids).toEqual(new Set([userA.id, userB.id]));
    });

    it("RN-010 · cerrar el owner anterior permite añadir uno nuevo", async () => {
      const admin = createAdminClient();
      const cromo = await createTestCromo({ allowMultipleUsers: false });
      const userA = await createTestUser();
      const userB = await createTestUser();

      const uniqueId = cromo.uniques[0].id;
      await setCurrentOwner(uniqueId, userA.id);
      await setCurrentOwner(uniqueId, userB.id); // cierra A internamente

      const { data: owners } = await admin
        .from("unique_ownership")
        .select("user_id, is_current_owner")
        .eq("unique_id", uniqueId);
      const current = (owners ?? []).filter(
        (o) => o.is_current_owner === true,
      );
      expect(current).toHaveLength(1);
      expect((current[0].user_id as string)).toBe(userB.id);

      // El histórico de A sigue ahí (RN-011: conservación del historial).
      const all = owners ?? [];
      const aRows = all.filter((o) => (o.user_id as string) === userA.id);
      expect(aRows.length).toBeGreaterThanOrEqual(1);
      expect(aRows[0].is_current_owner).toBe(false);
    });

    it("RN-011 (gap G2) · al re-insertar ownership para el mismo usuario, date_acquired NO se preserva", async () => {
      // Documentamos el comportamiento ACTUAL: cada insert lleva
      // date_acquired = now() en el DEFAULT, así que recuperar una copia
      // crea una entrada NUEVA con fecha actual y "olvida" la primera vez
      // que la tuvo. RN-011 dice "Se guarda la fecha original de obtención
      // y la fecha de última obtención", lo que requeriría:
      //   · UPDATE explicit a la entrada vieja del usuario, o
      //   · usar date_acquired = MIN(historial del usuario para ese unique).
      //
      // Cuando se aplique el fix de G2, este test pasará a verificar la
      // preservación. Por ahora documenta el gap.
      const admin = createAdminClient();
      const cromo = await createTestCromo({ allowMultipleUsers: false });
      const userA = await createTestUser();
      const userB = await createTestUser();

      const uniqueId = cromo.uniques[0].id;

      // 1. A obtiene la copia → fila #1.
      await setCurrentOwner(uniqueId, userA.id);
      const { data: firstRow } = await admin
        .from("unique_ownership")
        .select("date_acquired")
        .eq("unique_id", uniqueId)
        .eq("user_id", userA.id)
        .order("date_acquired", { ascending: true })
        .limit(1)
        .maybeSingle();
      const firstAcquired = firstRow?.date_acquired as string;
      expect(firstAcquired).toBeTruthy();

      // 2. B obtiene la copia (cierra a A) y luego A vuelve a obtenerla.
      await setCurrentOwner(uniqueId, userB.id);
      await new Promise((r) => setTimeout(r, 50));
      await setCurrentOwner(uniqueId, userA.id);

      // 3. La fila NUEVA de A tiene date_acquired actualizado, no el original.
      const { data: rowsForA } = await admin
        .from("unique_ownership")
        .select("date_acquired, is_current_owner")
        .eq("unique_id", uniqueId)
        .eq("user_id", userA.id)
        .order("date_acquired", { ascending: true });

      expect(rowsForA?.length).toBeGreaterThanOrEqual(2);
      const currentRow = (rowsForA ?? []).find((r) => r.is_current_owner === true);
      expect(currentRow).toBeTruthy();

      // GAP: la nueva fila NO tiene el date_acquired original; son fechas distintas.
      expect(currentRow?.date_acquired).not.toBe(firstAcquired);
    });
  },
);

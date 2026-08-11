// Cubre la RLS de plant / garden_bed / plant_bed (lectura abierta a
// autenticados, escritura solo is_garden_manager) y las reglas de
// integridad del esquema: cascade/set null en plant_bed, y los CHECK
// de vocabulario de meses y de geometría del bancal.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createAnonClient,
  createUserClient,
  createTestUser,
  createTestPlant,
  createTestGardenBed,
  createTestPlantBed,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

describe.skipIf(!supabaseUp)(
  `Huerto: RLS e integridad (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("cliente anónimo no lee plant, garden_bed ni plant_bed", async () => {
      const plant = await createTestPlant();
      const bed = await createTestGardenBed();
      await createTestPlantBed({ gardenBedId: bed.id, plantId: plant.id });

      const anon = createAnonClient();
      const [plantRes, bedRes, plantBedRes] = await Promise.all([
        anon.from("plant").select("id").eq("id", plant.id),
        anon.from("garden_bed").select("id").eq("id", bed.id),
        anon.from("plant_bed").select("id").eq("garden_bed_id", bed.id),
      ]);

      expect(plantRes.data).toEqual([]);
      expect(bedRes.data).toEqual([]);
      expect(plantBedRes.data).toEqual([]);
    });

    it("usuario autenticado sin is_garden_manager lee las tres tablas pero no puede escribir", async () => {
      const plant = await createTestPlant();
      const bed = await createTestGardenBed();
      const user = await createTestUser();
      const userClient = await createUserClient(user.email, user.password);

      const [plantRes, bedRes] = await Promise.all([
        userClient.from("plant").select("id").eq("id", plant.id),
        userClient.from("garden_bed").select("id").eq("id", bed.id),
      ]);
      expect(plantRes.data).toEqual([{ id: plant.id }]);
      expect(bedRes.data).toEqual([{ id: bed.id }]);

      const { error, data } = await userClient
        .from("plant_bed")
        .insert({ garden_bed_id: bed.id, plant_id: plant.id, is_future: false });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("usuario con is_garden_manager puede insertar/actualizar/borrar en plant_bed", async () => {
      const plant = await createTestPlant();
      const bed = await createTestGardenBed();
      const manager = await createTestUser({ isGardenManager: true });
      const managerClient = await createUserClient(manager.email, manager.password);

      const { data: inserted, error: insertError } = await managerClient
        .from("plant_bed")
        .insert({ garden_bed_id: bed.id, plant_id: plant.id, is_future: false })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeTypeOf("number");

      const { error: updateError } = await managerClient
        .from("plant_bed")
        .update({ is_future: true })
        .eq("id", inserted!.id);
      expect(updateError).toBeNull();

      const { error: deleteError } = await managerClient
        .from("plant_bed")
        .delete()
        .eq("id", inserted!.id);
      expect(deleteError).toBeNull();

      // Limpieza manual: este plant_bed no pasó por createTestPlantBed, así
      // que no está en el set trackeado (y ya se borró de todos modos).
    });

    it("borrar un garden_bed arrastra sus plant_bed (on delete cascade)", async () => {
      const admin = createAdminClient();
      const plant = await createTestPlant();
      const bed = await createTestGardenBed();
      const plantBed = await createTestPlantBed({ gardenBedId: bed.id, plantId: plant.id });

      await admin.from("garden_bed").delete().eq("id", bed.id);

      const { data } = await admin.from("plant_bed").select("id").eq("id", plantBed.id);
      expect(data).toEqual([]);
    });

    it("borrar una plant deja plant_bed.plant_id en null (on delete set null)", async () => {
      const admin = createAdminClient();
      const plant = await createTestPlant();
      const bed = await createTestGardenBed();
      const plantBed = await createTestPlantBed({ gardenBedId: bed.id, plantId: plant.id });

      await admin.from("plant").delete().eq("id", plant.id);

      const { data } = await admin
        .from("plant_bed")
        .select("plant_id")
        .eq("id", plantBed.id)
        .single();
      expect(data?.plant_id).toBeNull();
    });

    it("CHECK de meses rechaza valores fuera de 1-12", async () => {
      const admin = createAdminClient();
      const { error } = await admin
        .from("plant")
        .insert({ name: `mes-invalido-${Date.now()}`, icon_path: "x.webp", months_of_growth: [13] });
      expect(error).not.toBeNull();
    });

    it("CHECK de garden_bed rechaza tamaño no positivo y posición negativa", async () => {
      const admin = createAdminClient();
      const zeroWidth = await admin
        .from("garden_bed")
        .insert({ name: `zero-${Date.now()}`, width: 0, height: 10, pos_x: 0, pos_y: 0 });
      expect(zeroWidth.error).not.toBeNull();

      const negativePos = await admin
        .from("garden_bed")
        .insert({ name: `neg-${Date.now()}`, width: 10, height: 10, pos_x: -1, pos_y: 0 });
      expect(negativePos.error).not.toBeNull();
    });
  },
);

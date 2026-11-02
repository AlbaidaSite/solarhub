// Cubre la migración 20261102120000_map_media_bunny_stream.sql:
//   · CHECK map_media_source_chk (combinaciones válidas de tipo y origen).
//   · Trigger trg_map_media_guard_video_columns (solo service_role decide
//     el estado de un vídeo).
//   · RLS de map_media (sin cambios): el insert de un vídeo UPLOADING exige
//     ser autor del pin.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createTestPin,
  createTestUser,
  createUserClient,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

const uuid = () => crypto.randomUUID();

describe.skipIf(!supabaseUp)(
  `map_media · vídeos en Bunny Stream (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    describe("CHECK map_media_source_chk", () => {
      it.each([
        ["foto con bunny_video_id", { type: "PHOTO", path: "map-media/x.webp", bunny_video_id: uuid(), video_status: "READY" }],
        ["vídeo de Bunny sin video_status", { type: "VIDEO", path: null, bunny_video_id: uuid(), video_status: null }],
        ["vídeo sin path ni bunny_video_id", { type: "VIDEO", path: null, bunny_video_id: null, video_status: null }],
      ])("rechaza %s", async (_label, row) => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const { error } = await createAdminClient()
          .from("map_media")
          .insert({ pin_id: pin.id, ...row });
        expect(error).not.toBeNull();
        expect(error?.message).toContain("map_media_source_chk");
      });

      it.each([
        ["foto en Storage", { type: "PHOTO", path: "map-media/x.webp" }],
        ["vídeo legado en Storage", { type: "VIDEO", path: "map-media/x.mp4" }],
        ["vídeo en Bunny", { type: "VIDEO", path: null, bunny_video_id: uuid(), video_status: "PROCESSING" }],
        ["vídeo a medio migrar", { type: "VIDEO", path: "map-media/y.mp4", bunny_video_id: uuid(), video_status: "PROCESSING" }],
      ])("acepta %s", async (_label, row) => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const { error } = await createAdminClient()
          .from("map_media")
          .insert({ pin_id: pin.id, ...row });
        expect(error).toBeNull();
      });
    });

    describe("trigger de columnas de vídeo", () => {
      it("authenticated no puede insertar un vídeo ya READY", async () => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const client = await createUserClient(user.email, user.password);
        const { error } = await client.from("map_media").insert({
          pin_id: pin.id,
          type: "VIDEO",
          bunny_video_id: uuid(),
          video_status: "READY",
        });
        expect(error?.message).toContain("UPLOADING");
      });

      it("authenticated no puede fijar duration_s", async () => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const client = await createUserClient(user.email, user.password);
        const { error } = await client.from("map_media").insert({
          pin_id: pin.id,
          type: "VIDEO",
          bunny_video_id: uuid(),
          video_status: "UPLOADING",
          duration_s: 30,
        });
        expect(error?.message).toContain("duration_s");
      });

      it("authenticated no puede cambiar video_status ni bunny_video_id; service_role sí", async () => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const client = await createUserClient(user.email, user.password);
        const admin = createAdminClient();

        const { data: row, error: insErr } = await client
          .from("map_media")
          .insert({ pin_id: pin.id, type: "VIDEO", bunny_video_id: uuid(), video_status: "UPLOADING" })
          .select("id")
          .single();
        expect(insErr).toBeNull();

        // Sin política de UPDATE el cambio no llega a aplicarse; con ella,
        // lo pararía el trigger. En ambos casos el estado no cambia.
        await client.from("map_media").update({ video_status: "READY" }).eq("id", row!.id);
        await client.from("map_media").update({ bunny_video_id: uuid() }).eq("id", row!.id);
        const { data: after } = await admin
          .from("map_media")
          .select("video_status")
          .eq("id", row!.id)
          .single();
        expect(after?.video_status).toBe("UPLOADING");

        const { error: adminErr } = await admin
          .from("map_media")
          .update({ video_status: "READY", duration_s: 41 })
          .eq("id", row!.id);
        expect(adminErr).toBeNull();
      });

      it("el código actual (foto con path) sigue insertando", async () => {
        const user = await createTestUser();
        const pin = await createTestPin(user.id);
        const client = await createUserClient(user.email, user.password);
        const { error } = await client
          .from("map_media")
          .insert({ pin_id: pin.id, path: `map-media/${pin.id}/a.webp`, type: "PHOTO" });
        expect(error).toBeNull();
      });
    });

    describe("RLS (sin cambios)", () => {
      it("un usuario puede insertar un vídeo UPLOADING en su pin y no en el de otro", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();
        const pin = await createTestPin(owner.id);

        const ownerClient = await createUserClient(owner.email, owner.password);
        const { error: ownErr } = await ownerClient.from("map_media").insert({
          pin_id: pin.id,
          type: "VIDEO",
          bunny_video_id: uuid(),
          video_status: "UPLOADING",
        });
        expect(ownErr).toBeNull();

        const otherClient = await createUserClient(other.email, other.password);
        const { error: otherErr } = await otherClient.from("map_media").insert({
          pin_id: pin.id,
          type: "VIDEO",
          bunny_video_id: uuid(),
          video_status: "UPLOADING",
        });
        expect(otherErr).not.toBeNull();
      });
    });
  },
);

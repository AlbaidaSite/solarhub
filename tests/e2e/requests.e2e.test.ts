// Cubre RN-003 (alta por aprobación → activación) y RN-004 (request única
// pendiente) verificando los triggers SQL contra Postgres real.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createTestUser,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

describe.skipIf(!supabaseUp)(
  `RN-003 / RN-004 · requests (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("RN-003 · al aprobar la request, trg_activate_credentials_on_request_approval pone is_active=true", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: false });

      const { data: req, error: reqErr } = await admin
        .from("request")
        .insert({ user_id: user.id, message: "test" })
        .select("id")
        .single();
      expect(reqErr).toBeNull();

      // Aprobamos: el trigger debería poner credentials.is_active=true.
      await admin
        .from("request")
        .update({ is_approved: true })
        .eq("id", req!.id);

      const { data: cred } = await admin
        .from("credentials")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      expect(cred?.is_active).toBe(true);
    });

    it("RN-003 · denegar la request NO activa credentials", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: false });

      const { data: req } = await admin
        .from("request")
        .insert({ user_id: user.id })
        .select("id")
        .single();

      await admin.from("request").update({ is_approved: false }).eq("id", req!.id);

      const { data: cred } = await admin
        .from("credentials")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      expect(cred?.is_active).toBe(false);
    });

    it("RN-004 · get_email_registration_status devuelve 'pending' cuando hay una request pendiente", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: false });
      await admin.from("request").insert({ user_id: user.id });

      const { data, error } = await admin.rpc("get_email_registration_status", {
        p_email: user.email,
      });
      expect(error).toBeNull();
      expect(data).toBe("pending");
    });

    it("RN-004 · get_email_registration_status devuelve 'active' cuando la cuenta está activa", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: true });

      const { data } = await admin.rpc("get_email_registration_status", {
        p_email: user.email,
      });
      expect(data).toBe("active");
    });

    it("RN-004 · get_email_registration_status devuelve 'can_reregister' cuando la cuenta está inactiva SIN request pendiente", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: false });

      const { data } = await admin.rpc("get_email_registration_status", {
        p_email: user.email,
      });
      expect(data).toBe("can_reregister");
    });

    it("RN-004 · get_email_registration_status devuelve 'not_found' para email desconocido", async () => {
      const admin = createAdminClient();
      const { data } = await admin.rpc("get_email_registration_status", {
        p_email: "ghost-" + crypto.randomUUID() + "@e2e.test",
      });
      expect(data).toBe("not_found");
    });
  },
);

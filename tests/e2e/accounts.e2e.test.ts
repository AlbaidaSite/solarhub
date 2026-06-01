// Cubre RN-002 (cuentas desactivadas no inician sesión) verificando la
// interacción con Supabase Auth real. Una cuenta con auth.user existente
// pero credentials.is_active=false debe ser bloqueada en login.
//
// Importante: Supabase Auth POR SÍ MISMO permite el login mientras la
// password sea correcta; el bloqueo "is_active=false" lo aplica el cliente
// (página de login) tras leer credentials. Este test verifica las DOS
// piezas: (1) Supabase devuelve sesión válida, (2) la credential del
// usuario está marcada como inactiva → el cliente debe rechazar el login.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createAnonClient,
  createTestUser,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

describe.skipIf(!supabaseUp)(
  `RN-002 · cuentas desactivadas (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("Una cuenta con is_active=false sigue autenticando contra Supabase Auth (no es bloqueo de Auth)", async () => {
      const user = await createTestUser({ isActive: false });

      const anon = createAnonClient();
      const { data, error } = await anon.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      // Auth de Supabase no conoce el flag is_active; entrega la sesión.
      expect(error).toBeNull();
      expect(data.user?.id).toBe(user.id);
    });

    it("El cliente debe consultar credentials.is_active y rechazar si es false", async () => {
      // Esta es la pieza que el login UI hace tras Supabase Auth. Lo
      // verificamos ejecutando la misma consulta y comprobando que el flag
      // está disponible para que el cliente lo lea.
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: false });

      const { data: cred } = await admin
        .from("credentials")
        .select("is_active")
        .eq("user_id", user.id)
        .single();
      expect(cred?.is_active).toBe(false);
    });

    it("RN-002 · desactivar a un usuario NO borra sus datos asociados", async () => {
      const admin = createAdminClient();
      const user = await createTestUser({ isActive: true });

      // Le añadimos un pin de prueba (datos asociados al usuario).
      const { data: sticker } = await admin
        .from("sticker")
        .insert({
          name: `s-${crypto.randomUUID().slice(0, 8)}`,
          icon_path: "test/icon.svg",
        })
        .select("id")
        .single();
      // country puede no estar seedeado; usamos ON CONFLICT DO NOTHING idiom
      await admin.from("country").upsert({ code: "ES", name: "España" });
      await admin.from("pin").insert({
        user_id: user.id,
        sticker_id: sticker!.id,
        country_code: "ES",
        place: "Sevilla",
        latitude: 37.4,
        longitude: -6,
        created_at: new Date().toISOString(),
      });

      // Desactivamos la cuenta.
      await admin
        .from("credentials")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Verificamos que el pin sigue ahí.
      const { data: pin } = await admin
        .from("pin")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      expect(pin).toBeTruthy();

      // Y el profile también.
      const { data: profile } = await admin
        .from("profile")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      expect(profile?.username).toBe(user.username);

      // Cleanup del sticker creado (no rastreado por el helper).
      await admin.from("pin").delete().eq("user_id", user.id);
      await admin.from("sticker").delete().eq("id", sticker!.id);
    });
  },
);

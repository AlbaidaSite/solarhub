// Helpers compartidos por todos los tests E2E. Aquí vive:
//
//   · createAdminClient()         → cliente con service_role (bypass RLS)
//   · createAnonClient()          → cliente sin sesión (para login)
//   · createUserClient(email, pw) → cliente con sesión activa de ese usuario
//   · ensureCatalogReady()        → garantiza category/rarity mínimos
//   · createTestUser({...})       → crea auth user + profile + credentials
//   · cleanupTestUser(userId)     → elimina cascada (auth.user → profile…)
//   · createTestCromo({...})      → crea label + cromo + unique_cromos
//   · transferOwnership(uid, to)  → cierra owner anterior + inserta nuevo
//
// Y la pieza más crítica:
//
//   · supabaseUp                  → boolean detectado al cargar el módulo
//   · describeIfSupabase          → describe gateado, skipea si no hay BD
//
// Así `npm run test:e2e` con la BD apagada NO falla; los tests aparecen
// como skipped con un mensaje claro y la CI sigue su curso.

import { afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_E2E_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_E2E_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_E2E_SERVICE_ROLE_KEY ?? "";

const SUITE_TAG = `e2e-${Math.random().toString(36).slice(2, 8)}`;

// ─── Healthcheck al cargar el módulo ─────────────────────────────────────────

async function probeSupabase(): Promise<{ ok: boolean; reason?: string }> {
  if (!ANON || !SERVICE) {
    return {
      ok: false,
      reason:
        "Faltan SUPABASE_E2E_ANON_KEY / SUPABASE_E2E_SERVICE_ROLE_KEY en .env.test",
    };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${URL}/auth/v1/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? { ok: true } : { ok: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

const probe = await probeSupabase();

export const supabaseUp = probe.ok;
export const supabaseDownReason = probe.reason;

// Si la BD está abajo, imprime un aviso UNA vez al cargar el módulo.
if (!supabaseUp) {
  // eslint-disable-next-line no-console
  console.warn(
    `\n[e2e] Supabase local no disponible (${supabaseDownReason}). ` +
      `Los tests E2E se skipean. Ver tests/e2e/README.md.\n`,
  );
}

// ─── Factory de clientes ─────────────────────────────────────────────────────

export function createAdminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createUserClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  return client;
}

// ─── Helpers de creación / limpieza ──────────────────────────────────────────

export interface TestUserOpts {
  name?: string;
  isActive?: boolean;
  isStaff?: boolean;
  isSuperuser?: boolean;
  isLoukou?: boolean;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

// Recurso "rastreador": cualquier resource creado para un test queda
// registrado y se borra en `afterEach`. Aísla los tests entre sí sin
// truncar tablas globales.
const trackedUsers = new Set<string>();
const trackedCromos = new Set<number>();
const trackedLabels = new Set<number>();

export async function createTestUser(opts: TestUserOpts = {}): Promise<TestUser> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const username = `${SUITE_TAG}-${id.slice(0, 8)}`;
  const email = `${username}@e2e.test`;
  const password = "TestPwd1234!";

  const { data: auth, error: aErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (aErr || !auth.user) {
    throw new Error(`auth.admin.createUser failed: ${aErr?.message}`);
  }
  const uid = auth.user.id;
  trackedUsers.add(uid);

  // profile (trigger auto-crea credentials con todos los flags a false).
  const { error: pErr } = await admin.from("profile").insert({
    id: uid,
    username,
    name: opts.name ?? username,
  });
  if (pErr) throw new Error(`insert profile failed: ${pErr.message}`);

  // Ajustar credentials a la combinación pedida.
  const { error: cErr } = await admin
    .from("credentials")
    .update({
      is_active: opts.isActive ?? true,
      is_staff: opts.isStaff ?? false,
      is_superuser: opts.isSuperuser ?? false,
      is_loukou: opts.isLoukou ?? false,
    })
    .eq("user_id", uid);
  if (cErr) throw new Error(`update credentials failed: ${cErr.message}`);

  return { id: uid, email, password, username };
}

export interface TestCromoOpts {
  name?: string;
  copies?: number;
  forLoukou?: boolean;
  hideTilRegistered?: boolean;
  allowMultipleUsers?: boolean;
  codes?: number[]; // si no se pasan, se generan secuencialmente
}

export interface TestCromo {
  id: number;
  labelsId: number;
  categoryId: number;
  rarityId: number;
  uniques: Array<{ id: number; code: number; copyNumber: number }>;
}

// Cache para no repetir setup de category/rarity por test.
let catalogReady: { categoryId: number; rarityId: number } | null = null;

export async function ensureCatalogReady(): Promise<{
  categoryId: number;
  rarityId: number;
}> {
  if (catalogReady) return catalogReady;
  const admin = createAdminClient();

  // Reutilizamos uno existente o creamos uno con sufijo único para no
  // colisionar con seed real.
  const tag = SUITE_TAG;
  const { data: cat, error: cErr } = await admin
    .from("category")
    .insert({
      name: `cat-${tag}`,
      icon_path: "test/cat.svg",
      order_number: 999,
    })
    .select("id")
    .single();
  if (cErr || !cat) throw new Error(`create category failed: ${cErr?.message}`);

  const { data: rar, error: rErr } = await admin
    .from("rarity")
    .insert({ name: `rar-${tag}`, icon_path: "test/rar.svg" })
    .select("id")
    .single();
  if (rErr || !rar) throw new Error(`create rarity failed: ${rErr?.message}`);

  catalogReady = {
    categoryId: cat.id as number,
    rarityId: rar.id as number,
  };
  return catalogReady;
}

export async function createTestCromo(opts: TestCromoOpts = {}): Promise<TestCromo> {
  const admin = createAdminClient();
  const { categoryId, rarityId } = await ensureCatalogReady();

  const copies = opts.copies ?? 1;
  const baseCode = Math.floor(Math.random() * 30_000) + 1; // sin colisionar con SMALLINT_MIN
  const codes = opts.codes ?? Array.from({ length: copies }, (_, i) => baseCode + i);

  const { data: label, error: lErr } = await admin
    .from("cromo_labels")
    .insert({
      has_owners: false,
      hide_til_registered: opts.hideTilRegistered ?? false,
      for_loukou: opts.forLoukou ?? false,
      allow_multiple_users: opts.allowMultipleUsers ?? false,
    })
    .select("id")
    .single();
  if (lErr || !label) throw new Error(`create label failed: ${lErr?.message}`);
  trackedLabels.add(label.id as number);

  const number = Math.floor(Math.random() * 30_000) + 1;
  const { data: cromo, error: cErr } = await admin
    .from("cromo")
    .insert({
      category_id: categoryId,
      rarity_id: rarityId,
      labels_id: label.id,
      name: opts.name ?? `cromo-${SUITE_TAG}-${number}`,
      front_img: "test/front.webp",
      back_img: "test/back.webp",
      number,
      variant: 0,
      copies,
    })
    .select("id")
    .single();
  if (cErr || !cromo) throw new Error(`create cromo failed: ${cErr?.message}`);
  trackedCromos.add(cromo.id as number);

  const uniqueRows = codes.map((code, i) => ({
    cromo_id: cromo.id,
    code,
    copy_number: i + 1,
  }));
  const { data: uniques, error: uErr } = await admin
    .from("unique_cromo")
    .insert(uniqueRows)
    .select("id, code, copy_number");
  if (uErr || !uniques) throw new Error(`create uniques failed: ${uErr?.message}`);

  return {
    id: cromo.id as number,
    labelsId: label.id as number,
    categoryId,
    rarityId,
    uniques: uniques.map((u) => ({
      id: u.id as number,
      code: u.code as number,
      copyNumber: u.copy_number as number,
    })),
  };
}

// Inserta directamente un `unique_ownership` is_current_owner=true para
// `userId` sobre `uniqueId`, cerrando primero al posible owner anterior.
// Replica lo que haría un cierre de trade pero sin pasar por el trigger.
export async function setCurrentOwner(uniqueId: number, userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("unique_ownership")
    .update({ is_current_owner: false })
    .eq("unique_id", uniqueId)
    .eq("is_current_owner", true);
  const { error } = await admin
    .from("unique_ownership")
    .insert({ unique_id: uniqueId, user_id: userId, is_current_owner: true });
  if (error) throw new Error(`setCurrentOwner failed: ${error.message}`);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterEach(async () => {
  if (!supabaseUp) return;
  const admin = createAdminClient();

  // unique_ownership tiene FK ON DELETE CASCADE sobre unique_cromo, así que
  // al borrar el cromo se llevan las copias y ownerships con ellas.
  if (trackedCromos.size > 0) {
    await admin.from("cromo").delete().in("id", [...trackedCromos]);
    trackedCromos.clear();
  }
  if (trackedLabels.size > 0) {
    await admin.from("cromo_labels").delete().in("id", [...trackedLabels]);
    trackedLabels.clear();
  }
  // Trades (cualquiera donde participen usuarios trackeados) — los
  // borramos antes que los usuarios porque trade.initiator_id REFERENCES profile.
  if (trackedUsers.size > 0) {
    const ids = [...trackedUsers];
    await admin
      .from("trade")
      .delete()
      .or(
        ids
          .map((id) => `initiator_id.eq.${id},recipient_id.eq.${id}`)
          .join(","),
      );
    await admin.from("request").delete().in("user_id", ids);
    // profile.id REFERENCES auth.users.id ON DELETE CASCADE → borrar el auth user
    // se lleva profile + credentials + lo que penda.
    for (const uid of ids) {
      await admin.auth.admin.deleteUser(uid);
    }
    trackedUsers.clear();
  }
});

// ─── Re-export para los tests ────────────────────────────────────────────────

export { createClient };

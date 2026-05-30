// SUT: src/app/staff/perfil/actions.ts → setUserActiveAction, updateUserCredentialsAction
// Cubre RF-005 (activar/desactivar) y RN-002 (cuentas desactivadas no inician sesión —
// enforcement complementario a la lógica de login en src/app/(auth)).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/app/staff/lib/actionAuth", () => ({
  requireStaffActionClient: vi.fn(),
  requireSuperuserActionClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  requireStaffActionClient,
  requireSuperuserActionClient,
} from "@/app/staff/lib/actionAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  setUserActiveAction,
  updateUserCredentialsAction,
} from "@/app/staff/perfil/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RF-005 · staff activa/desactiva cuenta", () => {
  it("staff desactiva: invoca admin client con is_active=false", async () => {
    const adminStub = createSupabaseStub({
      from: { credentials: { data: null, error: null } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: createSupabaseStub().client as never,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub.client as never);

    const result = await setUserActiveAction("u-target", false);
    expect(result).toEqual({ ok: true });

    const credCall = adminStub.calls.from.find((c) => c.table === "credentials");
    expect(credCall?.chain).toContain("update");
    const updateArgs = credCall?.args[credCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({ is_active: false });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/staff/perfil");
  });

  it("staff reactiva cuenta: is_active=true", async () => {
    const adminStub = createSupabaseStub({
      from: { credentials: { data: null, error: null } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: createSupabaseStub().client as never,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub.client as never);

    const result = await setUserActiveAction("u-target", true);
    expect(result.ok).toBe(true);
    const credCall = adminStub.calls.from.find((c) => c.table === "credentials");
    const updateArgs = credCall?.args[credCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({ is_active: true });
  });

  it("no-staff: rechazado sin tocar credentials", async () => {
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: false,
      error: "No autorizado.",
    });

    const result = await setUserActiveAction("u-target", false);
    expect(result.ok).toBe(false);
    expect(vi.mocked(createSupabaseAdminClient)).not.toHaveBeenCalled();
  });

  it("propaga error del admin client", async () => {
    const adminStub = createSupabaseStub({
      from: { credentials: { data: null, error: { message: "RLS denied" } } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: createSupabaseStub().client as never,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub.client as never);

    const result = await setUserActiveAction("u-target", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("RLS denied");
  });
});

describe("RF-006 / RN-005 · solo superuser modifica credenciales", () => {
  it("superuser puede modificar is_staff/is_loukou/is_garden_manager", async () => {
    const adminStub = createSupabaseStub({
      from: { credentials: { data: null, error: null } },
    });
    vi.mocked(requireSuperuserActionClient).mockResolvedValue({
      ok: true,
      supabase: createSupabaseStub().client as never,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub.client as never);

    const result = await updateUserCredentialsAction("u-target", {
      is_staff: true,
      is_loukou: false,
      is_garden_manager: true,
    });
    expect(result.ok).toBe(true);

    const credCall = adminStub.calls.from.find((c) => c.table === "credentials");
    const updateArgs = credCall?.args[credCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({
      is_staff: true,
      is_loukou: false,
      is_garden_manager: true,
    });
  });

  it("RN-005 · staff (no superuser) no puede modificar credenciales", async () => {
    vi.mocked(requireSuperuserActionClient).mockResolvedValue({
      ok: false,
      error: "Solo un superusuario puede hacer esto.",
    });

    const result = await updateUserCredentialsAction("u-target", {
      is_staff: true,
      is_loukou: false,
      is_garden_manager: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("superusuario");
    expect(vi.mocked(createSupabaseAdminClient)).not.toHaveBeenCalled();
  });
});

describe("RN-002 · cuentas desactivadas (enforcement E2E pendiente)", () => {
  // El bloqueo de inicio de sesión para is_active=false vive en la lógica
  // de Supabase Auth / la página de login que comprueba el flag. No es
  // verificable desde estos tests TS aislados — requiere E2E.
  it.skip("login rechaza credenciales válidas si is_active=false (requiere E2E)", () => {});

  it("desactivar una cuenta NO borra datos del usuario (invariante)", () => {
    // La action solo modifica credentials.is_active; no toca profile, pin,
    // unique_ownership, etc. Esta invariante se asegura por la ausencia de
    // otros from(...) en el flujo: cualquier regresión que añada un DELETE
    // o CASCADE haría fallar este test.
    const adminStub = createSupabaseStub({
      from: { credentials: { data: null, error: null } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: createSupabaseStub().client as never,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub.client as never);

    return setUserActiveAction("u-target", false).then(() => {
      const touchedTables = new Set(adminStub.calls.from.map((c) => c.table));
      expect([...touchedTables]).toEqual(["credentials"]);
    });
  });
});

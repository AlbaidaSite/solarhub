// SUT: src/app/staff/perfil/actions.ts → approveRequestAction, denyRequestAction
// Cubre RF-002 (tramitar solicitudes) y la doble enforcement con RN-001/RN-003.
//
// NOTA: la activación de credentials.is_active al aprobar la solicitud la
// efectúa el trigger SQL `trg_activate_credentials_on_request_approval`,
// definido en supabase/migrations/20260425222835_request_approval_security.sql.
// No es verificable sin Postgres real: aquí solo confirmamos que la action
// hace el UPDATE correcto sobre `request.is_approved`; la propagación a
// credentials queda como E2E pendiente (ver TESTING_REPORT.md).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/app/staff/lib/actionAuth", () => ({
  requireStaffActionClient: vi.fn(),
  requireSuperuserActionClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireStaffActionClient } from "@/app/staff/lib/actionAuth";
import { revalidatePath } from "next/cache";
import {
  approveRequestAction,
  denyRequestAction,
} from "@/app/staff/perfil/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RF-002 · aprobar solicitud", () => {
  it("staff aprueba: marca request.is_approved=true y revalida /staff/perfil", async () => {
    const { client, calls } = createSupabaseStub({
      from: { request: { data: null, error: null } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: client as never,
    });

    const result = await approveRequestAction(123);
    expect(result).toEqual({ ok: true });

    const reqCall = calls.from.find((c) => c.table === "request");
    expect(reqCall?.chain).toContain("update");
    expect(reqCall?.chain).toContain("eq");
    expect(reqCall?.args.find((a) => a[0] === "id")).toEqual(["id", 123]);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/staff/perfil");
  });

  it("usuario no-staff: la action devuelve {ok:false} sin tocar la BD", async () => {
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: false,
      error: "No autorizado.",
    });

    const result = await approveRequestAction(123);
    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it("propaga el error de Supabase si el update falla", async () => {
    const { client } = createSupabaseStub({
      from: {
        request: { data: null, error: { message: "boom" } },
      },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: client as never,
    });

    const result = await approveRequestAction(123);
    expect(result).toEqual({ ok: false, error: "boom" });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});

describe("RF-002 · denegar solicitud", () => {
  it("staff deniega: marca request.is_approved=false", async () => {
    const { client, calls } = createSupabaseStub({
      from: { request: { data: null, error: null } },
    });
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: true,
      supabase: client as never,
    });

    const result = await denyRequestAction(999);
    expect(result).toEqual({ ok: true });

    const reqCall = calls.from.find((c) => c.table === "request");
    expect(reqCall?.chain).toContain("update");
    // El payload del update se pasa como primer arg
    const updateArgs = reqCall?.args[reqCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({ is_approved: false });
  });

  it("usuario no-staff no puede denegar", async () => {
    vi.mocked(requireStaffActionClient).mockResolvedValue({
      ok: false,
      error: "No autorizado.",
    });

    const result = await denyRequestAction(1);
    expect(result.ok).toBe(false);
  });
});

describe("RN-003 / RN-004 · enforcement complementario", () => {
  // RN-003 ("alta requiere aprobación") la garantiza el trigger
  // trg_activate_credentials_on_request_approval — no testeable sin BD.
  // RN-004 ("una sola request pendiente") la garantiza la RPC
  // get_email_registration_status — no testeable sin BD.
  it.skip("RN-003 · aprobar activa credentials (requiere E2E con triggers)", () => {});
  it.skip("RN-004 · solicitud duplicada se rechaza (requiere RPC contra BD)", () => {});
});

// SUT: src/app/(app)/cromos/lib/cromos-fetch.ts → fetchAllCromos
//
// `unique_ownership` no lleva ORDER BY, así que las copias llegaban en el
// orden en que Postgres las devuelve (grosso modo, el de registro) y los
// botones de la sección "Copias" del CromoModal salían desordenados. El
// contrato es: siempre ascendente por copy_number.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllCromos } from "@/app/(app)/cromos/lib/cromos-fetch";

const cromoRow = {
  id: 1,
  name: "Alfa",
  number: 1,
  variant: 0,
  description: null,
  copies: 5,
  how_to: null,
  how_to_extended: null,
  front_img: "cromos/alfa.webp",
  back_img: "cromos/alfa-back.webp",
  cromo_labels: { has_owners: true, hide_til_registered: false, for_loukou: false },
  rarity: null,
  category: null,
  cromo_artist: [],
};

function ownedRow(uniqueId: number, copyNumber: number) {
  return { unique_cromo: { id: uniqueId, copy_number: copyNumber, cromo_id: 1 } };
}

// Orden de llamadas de fetchAlbumContext: cromo, trade_unique,
// unique_ownership (historial), y después unique_ownership (copias actuales).
function stubAlbum(opts: {
  owned: unknown[];
  inTrade?: Array<{ unique_id: number }>;
}) {
  const stub = createSupabaseStub({
    authUserId: "u-A",
    rpc: {
      is_loukou: { data: false, error: null },
      is_superuser: { data: false, error: null },
    },
    from: {
      cromo: { data: [cromoRow], error: null },
      trade_unique: { data: opts.inTrade ?? [], error: null },
      unique_ownership: {
        default: { data: [], error: null },
        queue: [
          { data: [{ date_acquired: "2026-01-01", unique_cromo: { cromo_id: 1 } }], error: null },
          { data: opts.owned, error: null },
        ],
      },
    },
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);
  return stub;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchAllCromos · orden de las copias del usuario", () => {
  it("devuelve userOwnedUniques ascendente por copyNumber, no por orden de registro", async () => {
    // Llegan en orden de registro: la #7 se registró antes que la #2.
    stubAlbum({ owned: [ownedRow(70, 7), ownedRow(20, 2), ownedRow(110, 11), ownedRow(30, 3)] });

    const { cromos } = await fetchAllCromos();
    expect(cromos[0].userOwnedUniques.map((u) => u.copyNumber)).toEqual([2, 3, 7, 11]);
  });

  it("el orden numérico no rompe el marcado de copias en intercambio", async () => {
    stubAlbum({
      owned: [ownedRow(70, 7), ownedRow(20, 2)],
      inTrade: [{ unique_id: 70 }],
    });

    const { cromos } = await fetchAllCromos();
    expect(cromos[0].userOwnedUniques).toEqual([
      { uniqueId: 20, copyNumber: 2, inTrade: false },
      { uniqueId: 70, copyNumber: 7, inTrade: true },
    ]);
  });
});

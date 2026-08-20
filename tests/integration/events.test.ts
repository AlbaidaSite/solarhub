// SUT: src/app/(app)/eventos/actions.ts → getEventOccurrencesInRangeAction

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEventOccurrencesInRangeAction } from "@/app/(app)/eventos/actions";

const row = {
  id: 1,
  occurrence_date: "2026-06-15",
  title: "Fiesta de verano",
  description: null,
  place: "Sede",
  image_url: "event-images/1/foto.webp",
  url: null,
  includes_cromo: false,
  event_date: "2026-06-15T18:00:00Z",
  end_date: null,
  start_time_included: true,
  end_time_included: true,
  event_type_id: 3,
  event_type_code: "PARTY",
  event_type_name: "Fiesta",
  event_type_icon_path: "icons/party.svg",
  event_type_color: "amber-400",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRpc(result: { data: unknown; error: { message: string } | null }) {
  const stub = createSupabaseStub({ rpc: { events_in_range: result } });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);
  return stub;
}

describe("getEventOccurrencesInRangeAction", () => {
  it("llama al RPC con el rango pedido y devuelve las ocurrencias mapeadas", async () => {
    const stub = mockRpc({ data: [row], error: null });

    const result = await getEventOccurrencesInRangeAction("2026-06-01", "2026-07-05");

    expect(stub.calls.rpc).toEqual([
      { name: "events_in_range", args: { range_start: "2026-06-01", range_end: "2026-07-05" } },
    ]);
    expect(result).toEqual([
      {
        id: 1,
        occurrenceDate: "2026-06-15",
        title: "Fiesta de verano",
        description: null,
        place: "Sede",
        imageUrl: expect.stringContaining("event-images/1/foto.webp"),
        url: null,
        includesCromo: false,
        eventDate: "2026-06-15T18:00:00Z",
        endDate: null,
        startTimeIncluded: true,
        endTimeIncluded: true,
        eventType: {
          id: 3,
          code: "PARTY",
          name: "Fiesta",
          icon_path: expect.stringContaining("icons/party.svg"),
          color: "amber-400",
        },
      },
    ]);
  });

  it("no resuelve URL pública si el evento no tiene imagen", async () => {
    mockRpc({ data: [{ ...row, image_url: null }], error: null });
    const [result] = await getEventOccurrencesInRangeAction("2026-06-01", "2026-07-05");
    expect(result.imageUrl).toBeNull();
  });

  it("devuelve lista vacía si el RPC falla", async () => {
    mockRpc({ data: null, error: { message: "boom" } });
    const result = await getEventOccurrencesInRangeAction("2026-06-01", "2026-07-05");
    expect(result).toEqual([]);
  });
});

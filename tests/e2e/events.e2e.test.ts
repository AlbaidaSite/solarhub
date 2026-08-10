// Cubre la RPC `events_in_range` (expansión de recurrencia anual, 29-F,
// zona horaria Europe/Madrid, rango que cruza fin de año).
//
// Los triggers de guarda "recurrencia YEARLY + asistencia"
// (20260808120400_event_yearly_attendance_guard.sql) se eliminaron en
// 20260810140000_drop_attending_add_liked_event.sql junto con la tabla
// `attending` — sus tests vivían aquí y se han quitado con ellos.

import { describe, it, expect } from "vitest";
import {
  createAdminClient,
  createTestUser,
  createTestEventType,
  createTestEvent,
  supabaseUp,
  supabaseDownReason,
} from "./setup";

interface OccurrenceRow {
  id: number;
  occurrence_date: string;
  title: string;
}

async function eventsInRange(rangeStart: string, rangeEnd: string): Promise<OccurrenceRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("events_in_range", {
    range_start: rangeStart,
    range_end: rangeEnd,
  });
  if (error) throw new Error(`events_in_range failed: ${error.message}`);
  return (data ?? []) as OccurrenceRow[];
}

describe.skipIf(!supabaseUp)(
  `events_in_range (E2E)${supabaseDownReason ? ` · skipped (${supabaseDownReason})` : ""}`,
  () => {
    it("evento puntual: aparece dentro del rango y no fuera de él", async () => {
      const user = await createTestUser();
      const eventType = await createTestEventType();
      const event = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "2026-06-15T10:00:00+02:00",
        recurrence: "NONE",
        title: "Reunión puntual",
      });

      const inRange = await eventsInRange("2026-06-01", "2026-06-30");
      expect(inRange.map((o) => o.id)).toContain(event.id);

      const outOfRange = await eventsInRange("2026-07-01", "2026-07-31");
      expect(outOfRange.map((o) => o.id)).not.toContain(event.id);
    });

    it("evento anual: se ve proyectado en tres años distintos sin filas nuevas", async () => {
      const user = await createTestUser();
      const eventType = await createTestEventType();
      const event = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "1994-06-10T12:00:00+02:00",
        recurrence: "YEARLY",
        title: "Cumpleaños anual",
      });

      for (const year of [2026, 2027, 2030]) {
        const rows = await eventsInRange(`${year}-06-01`, `${year}-06-30`);
        const occurrence = rows.find((o) => o.id === event.id);
        expect(occurrence?.occurrence_date).toBe(`${year}-06-10`);
      }
    });

    it("29-F anual: cae en 29 en año bisiesto y en 28 en año no bisiesto", async () => {
      const user = await createTestUser();
      const eventType = await createTestEventType();
      const event = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "2024-02-29T10:00:00+01:00",
        recurrence: "YEARLY",
        title: "Cumpleaños 29-F",
      });

      const leapYearRows = await eventsInRange("2028-02-20", "2028-03-05");
      expect(leapYearRows.find((o) => o.id === event.id)?.occurrence_date).toBe("2028-02-29");

      const nonLeapYearRows = await eventsInRange("2027-02-20", "2027-03-05");
      expect(nonLeapYearRows.find((o) => o.id === event.id)?.occurrence_date).toBe("2027-02-28");
    });

    it("rango que cruza fin de año: incluye eventos de diciembre y de enero siguiente", async () => {
      const user = await createTestUser();
      const eventType = await createTestEventType();
      const decEvent = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "2026-12-31T10:00:00+01:00",
        title: "Fin de año",
      });
      const janEvent = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "2027-01-02T10:00:00+01:00",
        title: "Reyes",
      });

      const rows = await eventsInRange("2026-12-25", "2027-01-05");
      const ids = rows.map((o) => o.id);
      expect(ids).toContain(decEvent.id);
      expect(ids).toContain(janEvent.id);
    });

    it("evento nocturno en el límite de día: se dibuja en su día de Madrid, no en el de UTC", async () => {
      const user = await createTestUser();
      const eventType = await createTestEventType();
      // 2026-06-15T22:15:00Z = 2026-06-16T00:15 en Europe/Madrid (verano, UTC+2).
      const event = await createTestEvent({
        userId: user.id,
        eventTypeId: eventType.id,
        eventDate: "2026-06-15T22:15:00Z",
        title: "Fiesta nocturna",
      });

      const day16 = await eventsInRange("2026-06-16", "2026-06-16");
      expect(day16.find((o) => o.id === event.id)?.occurrence_date).toBe("2026-06-16");

      const day15 = await eventsInRange("2026-06-15", "2026-06-15");
      expect(day15.find((o) => o.id === event.id)).toBeUndefined();
    });
  },
);

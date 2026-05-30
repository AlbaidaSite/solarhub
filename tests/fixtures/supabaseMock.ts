// Stub mínimo del cliente Supabase para tests de integración. Construye
// una cadena `from(table).select().eq()...` thenable que resuelve a un
// `{ data, error }` predefinido.
//
// Uso típico:
//
//   const supabase = createSupabaseStub({
//     from: {
//       request: { default: { data: [], error: null } },
//       credentials: { default: { data: null, error: null } },
//     },
//     rpc: {
//       is_staff: { data: true, error: null },
//     },
//     authUserId: "u-1",
//   });
//
// Esto NO reimplementa Supabase: el caller controla qué resultado devuelve
// cada `from(table)` para la operación que ejecute. Para escenarios con
// varias llamadas consecutivas a la misma tabla, ver `setNext(table, ...)`.

import { vi } from "vitest";

export type StubResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
};

interface TableStub {
  default: StubResult;
  queue?: StubResult[];
}

interface SupabaseStubConfig {
  from?: Record<string, StubResult | TableStub>;
  rpc?: Record<string, StubResult>;
  authUserId?: string | null;
  storageUpload?: { error: { message: string } | null };
}

export interface SupabaseStub {
  client: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
    storage: { from: ReturnType<typeof vi.fn> };
  };
  calls: {
    from: Array<{ table: string; chain: string[]; args: unknown[][] }>;
    rpc: Array<{ name: string; args: unknown }>;
    storageRemove: Array<{ bucket: string; paths: string[] }>;
    storageUpload: Array<{ bucket: string; path: string }>;
  };
}

function tableToStub(t: StubResult | TableStub): TableStub {
  if ("default" in t && !("data" in t)) return t as TableStub;
  return { default: t as StubResult };
}

export function createSupabaseStub(config: SupabaseStubConfig = {}): SupabaseStub {
  const tables: Record<string, TableStub> = {};
  for (const [name, value] of Object.entries(config.from ?? {})) {
    tables[name] = tableToStub(value);
  }
  const rpcs = { ...(config.rpc ?? {}) };

  const calls: SupabaseStub["calls"] = {
    from: [],
    rpc: [],
    storageRemove: [],
    storageUpload: [],
  };

  function makeChain(table: string, current: ReturnType<typeof Object>) {
    const callRecord = { table, chain: [] as string[], args: [] as unknown[][] };
    calls.from.push(callRecord);

    const chain: Record<string, unknown> = {};
    const passThroughMethods = [
      "select",
      "insert",
      "update",
      "delete",
      "upsert",
      "eq",
      "neq",
      "gt",
      "lt",
      "in",
      "or",
      "order",
      "limit",
      "returns",
    ] as const;

    for (const m of passThroughMethods) {
      chain[m] = (...args: unknown[]) => {
        callRecord.chain.push(m);
        callRecord.args.push(args);
        return chain;
      };
    }

    const terminators = ["maybeSingle", "single"] as const;
    for (const m of terminators) {
      chain[m] = (...args: unknown[]) => {
        callRecord.chain.push(m);
        callRecord.args.push(args);
        // Sigue siendo thenable.
        return chain;
      };
    }

    // Make the chain thenable: `await supabase.from(...).select(...)` resolves
    // to the configured stub result for this table.
    chain.then = (onF: (v: StubResult) => unknown, onR?: (e: unknown) => unknown) => {
      const t = tables[table];
      const result = t?.queue?.shift() ?? t?.default ?? { data: null, error: null };
      return Promise.resolve(result).then(onF, onR);
    };

    return chain;
  }

  const client = {
    from: vi.fn((table: string) => makeChain(table, undefined)),
    rpc: vi.fn(async (name: string, args?: unknown) => {
      calls.rpc.push({ name, args });
      return rpcs[name] ?? { data: null, error: null };
    }),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: config.authUserId ? { id: config.authUserId } : null },
        error: null,
      })),
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string) => {
          calls.storageUpload.push({ bucket, path });
          return config.storageUpload ?? { error: null };
        }),
        remove: vi.fn(async (paths: string[]) => {
          calls.storageRemove.push({ bucket, paths });
          return { error: null };
        }),
      })),
    },
  };

  return { client, calls };
}

/**
 * Encola un resultado adicional para la próxima llamada a `from(table)`.
 * Útil cuando una action invoca la misma tabla varias veces y cada llamada
 * debe devolver un resultado distinto.
 */
export function enqueueTableResult(
  config: SupabaseStubConfig,
  table: string,
  result: StubResult,
): void {
  const slot = (config.from ??= {});
  const existing = slot[table];
  if (!existing || ("data" in existing && !("default" in existing))) {
    slot[table] = {
      default: existing
        ? (existing as StubResult)
        : { data: null, error: null },
      queue: [result],
    };
  } else {
    const stub = existing as TableStub;
    stub.queue = [...(stub.queue ?? []), result];
  }
}

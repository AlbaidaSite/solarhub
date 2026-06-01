// Las RPCs del proyecto devuelven siempre jsonb con la forma
//   { ok: true,  ...payload }  |  { ok: false, error: string }
// pero el cliente de Supabase nos lo entrega como `unknown`. Estos type
// guards lo narrows con una sola línea desde las server actions y evitan
// los `as unknown as { ... }` repartidos por el código.

export type RpcSuccessVoid = { ok: true };
export type RpcFailure = { ok: false; error: string };

export function isRpcFailure(v: unknown): v is RpcFailure {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { ok?: unknown }).ok === false &&
    typeof (v as { error?: unknown }).error === "string"
  );
}

export function isRpcSuccessVoid(v: unknown): v is RpcSuccessVoid {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { ok?: unknown }).ok === true
  );
}

// Versión genérica con un campo extra en éxito.
export function isRpcSuccessWith<K extends string, T>(
  v: unknown,
  key: K,
  typeCheck: (x: unknown) => x is T,
): v is { ok: true } & Record<K, T> {
  if (!isRpcSuccessVoid(v)) return false;
  return typeCheck((v as Record<string, unknown>)[key]);
}

export const isNumber = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);

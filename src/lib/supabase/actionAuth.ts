import "server-only";
import { createSupabaseServerClient } from "./server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ActionFailure = { ok: false; error: string };

// Auth helper para server actions accesibles por cualquier usuario autenticado
// (no staff). Mismo contrato que requireStaffActionClient en staff/lib: devuelve
// un objeto en vez de lanzar, para que la action haga `if (!auth.ok) return auth;`
// y mantenga `export async function` (las HOFs rompen la compilación de Next).
export async function requireUserActionClient(): Promise<
  { ok: true; supabase: ServerClient; userId: string } | ActionFailure
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };
  return { ok: true, supabase, userId: user.id };
}

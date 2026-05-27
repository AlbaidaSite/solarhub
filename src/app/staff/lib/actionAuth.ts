import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StaffClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ActionFailure = { ok: false; error: string };

const UNAUTHORIZED: ActionFailure = { ok: false, error: "No autorizado." };

// Helpers de autorización para server actions. Devolvemos un objeto (no
// lanzamos) para que la action pueda hacer `if (!auth.ok) return auth;` con
// dos líneas y dejar el resto del código limpio.
//
// Importante: las server actions deben declararse como `export async function`
// para que el compilador de Next.js las detecte correctamente; por eso esto
// es un helper interno y NO un HOF que envuelve la action.

export async function requireStaffActionClient(): Promise<
  { ok: true; supabase: StaffClient } | ActionFailure
> {
  const supabase = await createSupabaseServerClient();
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) return UNAUTHORIZED;
  return { ok: true, supabase };
}

export async function requireSuperuserActionClient(): Promise<
  { ok: true; supabase: StaffClient } | ActionFailure
> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;
  const { data: isSuperuser } = await auth.supabase.rpc("is_superuser");
  if (!isSuperuser) {
    return { ok: false, error: "Solo un superusuario puede hacer esto." };
  }
  return auth;
}

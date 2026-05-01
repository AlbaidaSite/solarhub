import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Comprueba sesión y permiso de staff/superuser. Si no se cumple redirige.
// Devuelve el cliente supabase ya inicializado para que la página lo reutilice.
export async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) redirect("/perfil");

  return supabase;
}

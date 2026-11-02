import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// ─── Auth: ¿puede el usuario actual editar/borrar este pin? ─────────────────
// Vive fuera de actions.ts porque un fichero "use server" expone como
// endpoint todo lo que exporta; así la comparten actions.ts y
// video-actions.ts sin publicarla.

export async function canEditPin(
  supabase: ServerClient,
  pinId: number,
  userId: string,
): Promise<boolean> {
  const { data: pin } = await supabase
    .from("pin")
    .select("user_id")
    .eq("id", pinId)
    .maybeSingle<{ user_id: string }>();

  if (!pin) return false;
  if (pin.user_id === userId) return true;

  // No es el dueño — usamos el RPC SECURITY DEFINER que bypasea RLS de credentials
  const { data: isStaff } = await supabase.rpc("is_staff");
  return Boolean(isStaff);
}

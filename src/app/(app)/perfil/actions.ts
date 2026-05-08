"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deactivateAccountAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await createSupabaseAdminClient()
    .from("credentials")
    .update({ is_active: false })
    .eq("user_id", user.id);

  await supabase.auth.signOut();
  redirect("/login");
}

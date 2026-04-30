import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import EditProfileView from "./components/EditProfileView";

export const metadata: Metadata = {
  title: "SolarHub - Editar perfil",
};

export default async function EditarPerfilPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("username")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileView
      currentEmail={user.email ?? ""}
      currentUsername={profile?.username ?? ""}
    />
  );
}

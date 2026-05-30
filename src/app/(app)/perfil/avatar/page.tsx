import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import AvatarEditor from "./components/AvatarEditor";

export const metadata: Metadata = {
  title: "SolarHub - Foto de perfil",
};

export default async function EditarAvatarPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AvatarEditor />;
}

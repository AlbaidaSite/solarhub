import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Pencil, UserCog } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl, DEFAULT_AVATAR_PATH } from "@/lib/supabase/storage";
import ProfilePanels from "./components/ProfilePanels";
import ProfileAvatar from "./components/ProfileAvatar";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "SolarHub - Perfil",
};

export default async function PerfilPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, isStaffRes] = await Promise.all([
    supabase
      .from("profile")
      .select("username, name, profile_img")
      .eq("id", user.id)
      .single(),
    supabase.rpc("is_staff"),
  ]);
  const profile = profileRes.data;
  const isStaff = Boolean(isStaffRes.data);

  const avatarUrl = getStorageUrl(profile?.profile_img || DEFAULT_AVATAR_PATH);

  return (
    <div className="relative w-full flex flex-col">
      {/* Cluster izquierdo: logout + (sólo staff) acceso al panel */}
      <div className="absolute top-0 left-0 z-10 flex items-center gap-2">
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut size={22} strokeWidth={2.5} />
            <span className="hidden nav:block text-base font-bold">Cerrar sesión</span>
          </button>
        </form>

        {isStaff && (
          <Link
            href="/staff"
            aria-label="Panel de staff"
            title="Panel de staff"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors"
          >
            <UserCog size={22} strokeWidth={2.5} />
            <span className="hidden nav:block text-base font-bold">Staff</span>
          </Link>
        )}
      </div>

      <Link
        href="/perfil/editar"
        aria-label="Editar perfil"
        className="absolute top-0 right-0 inline-flex items-center gap-2 px-3 py-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors z-10"
      >
        <span className="hidden nav:block text-base font-bold">Editar</span>
        <Pencil size={22} strokeWidth={2.5} />
      </Link>

      <header className="w-full flex flex-col items-center gap-4 mb-12">
        <ProfileAvatar avatarUrl={avatarUrl} username={profile?.username ?? "avatar"} />
        <h1 className="text-4xl font-bold text-white text-center">
          {profile?.username ?? "—"}
        </h1>
      </header>

      <ProfilePanels />
    </div>
  );
}

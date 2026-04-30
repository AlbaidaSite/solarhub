import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowBigLeftDash } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "SolarHub - Staff",
};

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // public.is_staff() devuelve true si el usuario actual tiene is_staff
  // O is_superuser (ver supabase/migrations/.../rls_policies.sql).
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) redirect("/perfil");

  return (
    <div className="relative w-full h-full">
      <Link
        href="/perfil"
        aria-label="Volver al perfil"
        title="Volver al perfil"
        className="absolute top-4 left-4 z-10 inline-flex items-center justify-center p-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors"
      >
        <ArrowBigLeftDash size={32} strokeWidth={2} />
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import { requireStaff } from "../lib/auth";
import StaffBackButton from "../components/StaffBackButton";
import { PendingRequestsTable, type PendingRow } from "./components/RequestsAdminList";
import UsersAdminList, { type UserRow } from "./components/UsersAdminList";

export const metadata: Metadata = { title: "Staff · Perfil | SolarHub" };

export default async function StaffPerfilPage() {
  const supabase = await requireStaff();

  const [{ data: pending }, { data: users }, { data: isSuperuser }] = await Promise.all([
    supabase.rpc("get_pending_requests_staff"),
    supabase.rpc("get_all_users_staff"),
    supabase.rpc("is_superuser"),
  ]);

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Perfil</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white/80">Solicitudes pendientes</h2>
        <PendingRequestsTable rows={(pending ?? []) as PendingRow[]} />
      </section>

      <hr className="border-white/10" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white/80">Usuarios</h2>
        <UsersAdminList rows={(users ?? []) as UserRow[]} isSuperuser={Boolean(isSuperuser)} />
      </section>
    </div>
  );
}

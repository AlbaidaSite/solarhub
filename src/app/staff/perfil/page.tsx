import type { Metadata } from "next";
import { requireStaff } from "../lib/auth";
import StaffPageShell from "../components/StaffPageShell";
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
    <StaffPageShell title="Perfil">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white/80">Solicitudes pendientes</h2>
        <PendingRequestsTable rows={(pending ?? []) as PendingRow[]} />
      </section>

      <hr className="border-white/10" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white/80">Usuarios</h2>
        <UsersAdminList rows={(users ?? []) as UserRow[]} isSuperuser={Boolean(isSuperuser)} />
      </section>
    </StaffPageShell>
  );
}

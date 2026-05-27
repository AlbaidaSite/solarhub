import type { Metadata } from "next";
import { requireStaff } from "../lib/auth";
import StaffPageShell from "../components/StaffPageShell";

export const metadata: Metadata = { title: "Staff · Eventos | SolarHub" };

export default async function StaffEventosPage() {
  await requireStaff();
  return <StaffPageShell title="Eventos">{null}</StaffPageShell>;
}

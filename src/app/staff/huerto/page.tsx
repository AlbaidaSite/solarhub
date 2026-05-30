import type { Metadata } from "next";
import { requireStaff } from "../lib/auth";
import StaffPageShell from "../components/StaffPageShell";

export const metadata: Metadata = { title: "Staff · Huerto | SolarHub" };

export default async function StaffHuertoPage() {
  await requireStaff();
  return <StaffPageShell title="Huerto">{null}</StaffPageShell>;
}

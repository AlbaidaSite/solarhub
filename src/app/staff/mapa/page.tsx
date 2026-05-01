import type { Metadata } from "next";
import { requireStaff } from "../lib/auth";
import StaffBackButton from "../components/StaffBackButton";

export const metadata: Metadata = { title: "Staff · Mapa | SolarHub" };

export default async function StaffMapaPage() {
  await requireStaff();
  return (
    <div className="relative w-full min-h-full p-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton />
      </div>
      <h1 className="text-3xl font-bold text-white text-center mt-12">Mapa</h1>
    </div>
  );
}

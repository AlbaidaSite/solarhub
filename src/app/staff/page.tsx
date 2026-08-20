import type { Metadata } from "next";
import Link from "next/link";

import { requireStaff } from "./lib/auth";
import StaffBackButton from "./components/StaffBackButton";
import { MENU_ITEMS } from "@/constants/navigation";

export const metadata: Metadata = {
  title: "SolarHub - Staff",
};

export default async function StaffPage() {
  await requireStaff();

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-8">
      {/* Botón volver al perfil */}
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/perfil" label="Volver al perfil" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Panel de Staff</h1>

      {/* Grid de botones — ratio 3:4 (3 columnas de ancho, 4 de alto).
          El ancho máximo sube por tramos en vez de quedarse clavado en
          max-w-4xl: en monitores anchos las cinco tarjetas se quedaban
          diminutas en el centro con medio viewport vacío a los lados. El
          icono y el rótulo escalan con ellas para que la tarjeta no crezca
          alrededor de un contenido que sigue siendo del mismo tamaño. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 xl:gap-6 max-w-4xl xl:max-w-6xl 2xl:max-w-[96rem] mx-auto w-full">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const staffHref = `/staff${item.href}`;
          return (
            <Link
              key={item.href}
              href={staffHref}
              className="aspect-3/4 flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-amber-300/50 transition-all duration-200 group"
            >
              <Icon
                size={48}
                strokeWidth={1.5}
                className="size-12 xl:size-16 2xl:size-20 text-white/80 group-hover:text-amber-300 transition-colors duration-200"
              />
              <span className="text-base xl:text-lg 2xl:text-xl font-bold text-white/80 group-hover:text-amber-300 transition-colors duration-200">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

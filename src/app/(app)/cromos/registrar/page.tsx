import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Category } from "@/types/cromo";
import RegisterCromoForm from "./components/RegisterCromoForm";

export const metadata: Metadata = {
  title: "SolarHub - Registrar Cromo",
};

interface CategoryRow {
  id: number;
  name: string;
  icon_path: string;
  order_number: number;
}

export default async function RegistrarCromoPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("category")
    .select("id, name, icon_path, order_number")
    .order("order_number", { ascending: true });

  if (error) {
    return <p className="p-4 text-red-500">Error cargando categorías: {error.message}</p>;
  }

  const categories: Category[] = ((data ?? []) as CategoryRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    icon_path: getStorageUrl(c.icon_path),
    order_number: c.order_number,
  }));

  return <RegisterCromoForm categories={categories} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TradeListClient from "./components/TradeListClient";

export const metadata: Metadata = { title: "Intercambios | SolarHub" };

interface TradeRow {
  id: number;
  created_at: string;
  initiator: { id: string; username: string } | null;
  recipient: { id: string; username: string } | null;
}

interface ProfileRow {
  id: string;
  username: string;
}

export default async function IntercambiosPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tradesRes, profilesRes] = await Promise.all([
    supabase
      .from("trade")
      .select(
        "id, created_at, initiator:initiator_id(id, username), recipient:recipient_id(id, username)",
      )
      .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("is_mutual_agreement", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profile")
      .select("id, username")
      .neq("id", user.id)
      .order("username", { ascending: true }),
  ]);

  const trades = ((tradesRes.data ?? []) as unknown as TradeRow[]).map((t) => ({
    id: t.id,
    createdAt: t.created_at,
    otherUser: t.initiator?.id === user.id ? t.recipient : t.initiator,
  }));

  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 p-4 pt-6">
      <h1 className="text-3xl font-bold text-white text-center">Intercambios</h1>

      <TradeListClient
        trades={trades}
        profiles={profiles}
        currentUserId={user.id}
      />
    </div>
  );
}

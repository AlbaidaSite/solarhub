import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getThumbUrl } from "@/lib/supabase/storage";
import TradeDetailClient from "./components/TradeDetailClient";

export const metadata: Metadata = { title: "Intercambio | SolarHub" };

interface TradeUniqueRaw {
  unique_id: number;
  unique_cromo: {
    id: number;
    copy_number: number;
    cromo: { id: number; name: string; front_img: string };
  } | null;
}

interface TradeOfferRaw {
  id: number;
  user_id: string;
  is_accepted: boolean;
  trade_unique: TradeUniqueRaw[];
}

interface TradeRaw {
  id: number;
  is_mutual_agreement: boolean;
  initiator_id: string;
  recipient_id: string;
  initiator: { id: string; username: string } | null;
  recipient: { id: string; username: string } | null;
  trade_offer: TradeOfferRaw[];
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const tradeId = parseInt(id, 10);
  if (isNaN(tradeId)) notFound();

  const { data, error } = await supabase
    .from("trade")
    .select(
      `id, is_mutual_agreement, initiator_id, recipient_id,
       initiator:initiator_id(id, username),
       recipient:recipient_id(id, username),
       trade_offer(
         id, user_id, is_accepted,
         trade_unique(
           unique_id,
           unique_cromo!unique_id(id, copy_number, cromo:cromo_id(id, name, front_img))
         )
       )`,
    )
    .eq("id", tradeId)
    .single();

  if (error || !data) notFound();

  const trade = data as unknown as TradeRaw;

  // Solo los participantes pueden ver el trade
  const isParticipant =
    trade.initiator_id === user.id || trade.recipient_id === user.id;
  if (!isParticipant) notFound();

  const myOffer   = trade.trade_offer.find((o) => o.user_id === user.id)!;
  const theirOffer = trade.trade_offer.find((o) => o.user_id !== user.id)!;

  const otherProfile =
    trade.initiator_id === user.id ? trade.recipient : trade.initiator;

  // Resolver thumbnails server-side (función pura, sin DB)
  const resolveOffer = (offer: TradeOfferRaw) => ({
    id: offer.id,
    userId: offer.user_id,
    isAccepted: offer.is_accepted,
    uniques: (offer.trade_unique ?? []).map((tu) => ({
      uniqueId: tu.unique_id,
      copyNumber: tu.unique_cromo?.copy_number ?? 0,
      cromoName: tu.unique_cromo?.cromo?.name ?? "—",
      thumbUrl: tu.unique_cromo?.cromo?.front_img
        ? getThumbUrl(tu.unique_cromo.cromo.front_img)
        : null,
    })),
  });

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/intercambios"
          className="p-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={22} strokeWidth={2.5} />
        </Link>
        <h1 className="text-2xl font-bold text-white">
          Intercambio con&nbsp;
          <span className="text-amber-300"> {otherProfile?.username ?? "—"}</span>
        </h1>
      </div>

      {trade.is_mutual_agreement && (
        <div className="rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-4 py-3 text-emerald-300 text-sm font-semibold text-center">
          ✓ Intercambio completado
        </div>
      )}

      <TradeDetailClient
        tradeId={tradeId}
        myOffer={resolveOffer(myOffer)}
        theirOffer={resolveOffer(theirOffer)}
        otherUsername={otherProfile?.username ?? "—"}
        isCompleted={trade.is_mutual_agreement}
        currentUserId={user.id}
      />
    </div>
  );
}

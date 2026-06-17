"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { acceptTradeAction, removeUniqueFromTradeAction, unacceptTradeAction } from "../actions";
import { addUniqueByCodeToMyTradeOfferAction, getCategoriesAction } from "../../actions";
import AddCromoToTradeModal from "./AddCromoToTradeModal";
import InlineRegisterModal from "@/app/(app)/cromos/components/InlineRegisterModal";
import { getThumbUrl } from "@/lib/supabase/storage";
import type { Category } from "@/types/cromo";

interface UniqueItem {
  uniqueId: number;
  copyNumber: number;
  cromoName: string;
  thumbUrl: string | null;
}

interface Offer {
  id: number;
  userId: string;
  isAccepted: boolean;
  uniques: UniqueItem[];
}

interface TradeDetailClientProps {
  tradeId: number;
  myOffer: Offer;
  theirOffer: Offer;
  otherUsername: string;
  isCompleted: boolean;
  currentUserId: string;
}

const LOCKED_THUMB = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/solarhub-assets/cromos/thumb/locked.webp`;

export default function TradeDetailClient({
  tradeId,
  myOffer: initialMyOffer,
  theirOffer,
  otherUsername,
  isCompleted,
}: TradeDetailClientProps) {
  const router = useRouter();
  const [myOffer, setMyOffer]                  = useState(initialMyOffer);
  const [showAddModal, setShowAddModal]        = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [quickRegisterCats, setQuickRegisterCats] = useState<Category[] | null>(null);
  const pendingAddData = useRef<UniqueItem | null>(null);
  // localIsAccepted: estado optimista independiente para que el botón
  // cambie de "Aceptar" → "No aceptar aún" de forma inmediata, sin
  // esperar el router.refresh().
  const [localIsAccepted, setLocalIsAccepted] = useState(initialMyOffer.isAccepted);
  const [isPending, startTransition]        = useTransition();
  const [actionError, setActionError]       = useState<string | null>(null);

  const handleAccept = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await acceptTradeAction(tradeId);
      if (result.ok) {
        setLocalIsAccepted(true);
        router.refresh();
      } else {
        setActionError(result.error);
      }
    });
  };

  const handleUnaccept = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await unacceptTradeAction(tradeId);
      if (result.ok) {
        setLocalIsAccepted(false);
        router.refresh();
      } else {
        setActionError(result.error);
      }
    });
  };

  const handleOpenAddByCode = async () => {
    setActionError(null);
    if (!quickRegisterCats) {
      const cats = await getCategoriesAction();
      setQuickRegisterCats(cats as Category[]);
    }
    setShowQuickRegister(true);
  };

  // Acción del modal "Añadir con código": NO registra; sólo verifica
  // propiedad y añade el unique a la oferta del usuario.
  const submitAddByCode = async (categoryId: number, code: number) => {
    const result = await addUniqueByCodeToMyTradeOfferAction(tradeId, categoryId, code);
    if (result.ok) {
      pendingAddData.current = {
        uniqueId: result.uniqueId,
        copyNumber: result.copyNumber,
        cromoName: result.cromoName,
        thumbUrl: result.thumbPath ? getThumbUrl(result.thumbPath) : null,
      };
      return { ok: true as const, uniqueId: result.uniqueId };
    }
    return { ok: false as const, error: result.error };
  };

  const handleAddedByCode = (_idSlug: string | null, _uniqueId: number) => {
    const data = pendingAddData.current;
    pendingAddData.current = null;
    setShowQuickRegister(false);
    setLocalIsAccepted(false);
    if (data) {
      setMyOffer((prev) => ({
        ...prev,
        isAccepted: false,
        uniques: [...prev.uniques, data],
      }));
    }
    router.refresh();
  };

  const handleRemoveUnique = (uniqueId: number) => {
    setActionError(null);
    startTransition(async () => {
      const result = await removeUniqueFromTradeAction(myOffer.id, uniqueId);
      if (result.ok) {
        // El trigger DB resetea is_accepted; actualizamos estado local también.
        setLocalIsAccepted(false);
        setMyOffer((prev) => ({
          ...prev,
          isAccepted: false,
          uniques: prev.uniques.filter((u) => u.uniqueId !== uniqueId),
        }));
        router.refresh();
      } else {
        setActionError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {actionError && (
        <p className="text-chip text-red-400 text-sm text-center">{actionError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OfferColumn
          title="Mi oferta"
          offer={myOffer}
          isAcceptedDisplay={localIsAccepted}
          isMine
          isCompleted={isCompleted}
          isPending={isPending}
          onRemove={handleRemoveUnique}
          onAccept={handleAccept}
          onUnaccept={handleUnaccept}
          onAddCromo={() => setShowAddModal(true)}
          onQuickRegister={handleOpenAddByCode}
        />

        <OfferColumn
          title={`Oferta de ${otherUsername}`}
          offer={theirOffer}
          isAcceptedDisplay={theirOffer.isAccepted}
          isMine={false}
          isCompleted={isCompleted}
          isPending={false}
          onRemove={() => {}}
          onAccept={() => {}}
          onUnaccept={() => {}}
          onAddCromo={() => {}}
          onQuickRegister={() => {}}
        />
      </div>

      {showQuickRegister && quickRegisterCats && (
        <InlineRegisterModal
          categories={quickRegisterCats}
          title="Añadir con código"
          submitLabel="Añadir con código"
          submitAction={submitAddByCode}
          onClose={() => setShowQuickRegister(false)}
          onSuccess={handleAddedByCode}
        />
      )}

      {showAddModal && (
        <AddCromoToTradeModal
          tradeOfferId={myOffer.id}
          onClose={() => setShowAddModal(false)}
          onAdded={(uniqueId, cromoName, copyNumber, thumbUrl) => {
            setLocalIsAccepted(false);
            setMyOffer((prev) => ({
              ...prev,
              isAccepted: false,
              uniques: [...prev.uniques, { uniqueId, copyNumber, cromoName, thumbUrl }],
            }));
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function OfferColumn({
  title,
  offer,
  isAcceptedDisplay,
  isMine,
  isCompleted,
  isPending,
  onRemove,
  onAccept,
  onUnaccept,
  onAddCromo,
  onQuickRegister,
}: {
  title: string;
  offer: Offer;
  isAcceptedDisplay: boolean;
  isMine: boolean;
  isCompleted: boolean;
  isPending: boolean;
  onRemove: (uid: number) => void;
  onAccept: () => void;
  onUnaccept: () => void;
  onAddCromo: () => void;
  onQuickRegister: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/30 flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-bold text-white/80 uppercase tracking-wide">{title}</h2>
        {isAcceptedDisplay ? (
          <span className="text-xs font-semibold text-emerald-400">✓ Aceptado</span>
        ) : (
          <span className="text-xs text-white/40">Pendiente</span>
        )}
      </div>

      {/* Lista de uniques */}
      <div className="flex-1 divide-y divide-white/10 min-h-30">
        {offer.uniques.length === 0 && (
          <p className="px-4 py-6 text-center text-white/40 text-sm">Sin cromos añadidos.</p>
        )}
        {offer.uniques.map((u) => (
          <div key={u.uniqueId} className="flex items-center gap-3 px-4 py-2">
            <div className="relative w-8 h-8 shrink-0 rounded overflow-hidden bg-zinc-800">
              <Image
                src={u.thumbUrl ?? LOCKED_THUMB}
                alt={u.cromoName}
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{u.cromoName}</p>
              <p className="text-white/50 text-xs">Copia #{u.copyNumber}</p>
            </div>
            {isMine && !isCompleted && (
              <button
                type="button"
                onClick={() => onRemove(u.uniqueId)}
                disabled={isPending}
                aria-label="Quitar de la oferta"
                className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Acciones (solo en mi columna) */}
      {isMine && !isCompleted && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={onAddCromo}
            disabled={isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2.5} />
            Añadir cromo
          </button>

          <button
            type="button"
            onClick={onQuickRegister}
            disabled={isPending}
            title="Añadir a la oferta un cromo del que ya eres dueño, identificándolo por su código"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={14} strokeWidth={2.5} />
            Añadir con código
          </button>

          {isAcceptedDisplay ? (
            <button
              type="button"
              onClick={onUnaccept}
              disabled={isPending}
              className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/80 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 transition-colors cursor-pointer"
            >
              {isPending ? "Procesando…" : "No aceptar aún"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAccept}
              disabled={isPending}
              className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            >
              {isPending ? "Procesando…" : "Aceptar intercambio"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

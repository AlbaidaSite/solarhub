"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { getUsernamesAction } from "../actions";
import type { Pin, Sticker } from "@/types/map";

interface ClusterPopupProps {
  pins: Pin[];
  stickers: Map<number, Sticker>;
  onSelectPin: (pinId: number, lat: number, lng: number) => void;
  onClose: () => void;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getFullYear()).slice(2),
  ].join("/");
}

export default function ClusterPopup({
  pins,
  stickers,
  onSelectPin,
  onClose,
}: ClusterPopupProps) {
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...new Set(pins.map((p) => p.user_id))];
    getUsernamesAction(ids).then(setUsernames).catch(() => {});
  }, [pins]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloquear scroll del main mientras esté abierto
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prev = main.style.overflow;
    main.style.overflow = "hidden";
    return () => { main.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full md:max-w-sm bg-zinc-950 border border-white/15 rounded-t-2xl md:rounded-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-white">
            {pins.length} pines en este lugar
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1 rounded-full text-white/50 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista */}
        <ul className="overflow-y-auto flex-1 py-2 scrollbar-clean">
          {pins.map((pin) => {
            const sticker = stickers.get(pin.sticker_id);
            const username = usernames[pin.user_id];
            return (
              <li key={pin.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer text-left"
                  onClick={() => {
                    onClose();
                    onSelectPin(pin.id, pin.latitude, pin.longitude);
                  }}
                >
                  {sticker ? (
                    <div className="relative w-9 h-9 shrink-0">
                      <Image
                        src={sticker.icon_path}
                        alt={sticker.name}
                        fill
                        sizes="36px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 shrink-0 rounded-full bg-zinc-800" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{pin.place}</p>
                    <p className="text-xs text-white/50">
                      {formatShortDate(pin.created_at)}
                      {username && (
                        <> · <span className="text-amber-300/80">@{username}</span></>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

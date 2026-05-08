"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { CromoOwnershipState } from "@/types/cromo";

const LOCKED_URL = getStorageUrl("cromos/locked.webp");

interface CromoCardProps {
  cromo: {
    id: number;
    name: string;
    front_thumb: string;
    ownershipState: CromoOwnershipState;
    isImageLocked: boolean;
    how_to: string | null;
  };
  onClick?: () => void;
}

interface VanillaTiltNode extends HTMLButtonElement {
  vanillaTilt?: { destroy: () => void };
}

const GENERIC_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAQAAAAlAOY/AAAAFklEQVR42mNk+M9Qz8DAwMjA8B8AB44C/4gtoeMAAAAASUVORK5CYII=";

export default function CromoCard({ cromo, onClick }: CromoCardProps) {
  const tiltRef = useRef<VanillaTiltNode>(null);

  useEffect(() => {
    if (!tiltRef.current) return;

    let mounted = true;
    const node = tiltRef.current;

    import("vanilla-tilt")
      .then((mod) => {
        if (!mounted) return;
        const VanillaTilt = mod.default ?? mod;
        VanillaTilt.init(node, {
          max: 12,
          perspective: 1200,
          scale: 1.03,
          speed: 300,
        });
      })
      .catch(() => {
        // tilt is a progressive enhancement — fail silently
      });

    return () => {
      mounted = false;
      node.vanillaTilt?.destroy();
    };
  }, []);

  const displayThumb  = cromo.isImageLocked ? LOCKED_URL : cromo.front_thumb;
  const isGrayscale   = cromo.ownershipState !== "owned" && !cromo.isImageLocked;
  const showHowToOverlay = cromo.ownershipState === "never_owned" && cromo.how_to;

  return (
    <button
      ref={tiltRef}
      type="button"
      onClick={onClick}
      aria-label={cromo.name}
      className="group will-change-transform rounded-xl block w-full p-0 text-left cursor-pointer bg-transparent border-0"
    >
      <div className="relative w-full aspect-1642/2223 rounded-xl overflow-hidden bg-zinc-900 transition-all duration-300 hover:shadow-[0_0_0_2px_#343742,0_0_12px_#E0E7FF]">
        <Image
          src={displayThumb}
          alt={cromo.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className={`object-cover scale-[1.1] transition-opacity duration-300${isGrayscale ? " grayscale" : ""}`}
          placeholder="blur"
          blurDataURL={GENERIC_BLUR_DATA_URL}
        />

        {showHowToOverlay && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="bg-black/80 rounded-md px-3 py-2 max-w-full">
              <p className="text-white text-xs text-center leading-snug line-clamp-6">
                {cromo.how_to}
              </p>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

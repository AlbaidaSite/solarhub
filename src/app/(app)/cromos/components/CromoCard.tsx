"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

interface CromoCardProps {
  cromo: {
    id: number;
    name: string;
    front_thumb: string;
    isLocked: boolean;
    how_to: string | null;
  };
  href: string;
}

interface VanillaTiltNode extends HTMLAnchorElement {
  vanillaTilt?: { destroy: () => void };
}

// Placeholder genérico (4×3 px gris oscuro) que Next.js escala y difumina
// mientras carga la imagen real. Mejora la percepción de carga sin
// necesitar un blurDataURL por imagen.
const GENERIC_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAQAAAAlAOY/AAAAFklEQVR42mNk+M9Qz8DAwMjA8B8AB44C/4gtoeMAAAAASUVORK5CYII=";

export default function CromoCard({ cromo, href }: CromoCardProps) {
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

  const showHowToOverlay = cromo.isLocked && cromo.how_to;

  return (
    <Link
      ref={tiltRef}
      href={href}
      aria-label={cromo.name}
      className="group will-change-transform rounded-xl block w-full p-0 cursor-pointer"
    >
      <div className="relative w-full aspect-1642/2223 rounded-xl overflow-hidden bg-zinc-900 transition-all duration-300 hover:shadow-[0_0_0_2px_#343742,0_0_12px_#E0E7FF]">
        <Image
          src={cromo.front_thumb}
          alt={cromo.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover scale-[1.1] transition-opacity duration-300"
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
    </Link>
  );
}

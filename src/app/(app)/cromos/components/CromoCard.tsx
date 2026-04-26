"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import type { Cromo } from "@/types/cromo"

interface CromoCardProps {
  cromo: Cromo;
}

interface VanillaTiltNode extends HTMLDivElement {
  vanillaTilt?: { destroy: () => void };
}

export default function CromoCard({ cromo }: CromoCardProps) {
  const tiltRef = useRef<VanillaTiltNode>(null)

  useEffect(() => {
    if (!tiltRef.current) return

    let mounted = true
    const node = tiltRef.current

    import("vanilla-tilt")
      .then((mod) => {
        if (!mounted) return
        const VanillaTilt = mod.default ?? mod

        VanillaTilt.init(node, {
          max: 12,
          perspective: 1200,
          scale: 1.03,
          speed: 300,
        })
      })
      .catch(() => {
        // tilt is a progressive enhancement — fail silently
      })

    return () => {
      mounted = false
      node.vanillaTilt?.destroy()
    }
  }, [])

  return (
    <div
      ref={tiltRef}
      className="group will-change-transform rounded-xl"
    >
      <div
        className={
          "relative w-full aspect-1642/2223 rounded-xl overflow-hidden bg-zinc-900 transition-all duration-300 hover:shadow-[0_0_0_2px_#343742,0_0_12px_#E0E7FF]"
        }
      >
        <Image
          src={cromo.front_img}
          alt={cromo.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className={
            "object-cover scale-[1.1] transition-opacity duration-300"
          }
          priority={false}
        />
      </div>
    </div>
  )
}

"use client";

import { useRouter } from "next/navigation";
import CromoModal from "./CromoModal";
import type { CromoDetail } from "@/types/cromo";

interface NeighborRef {
  idSlug: string;
}

interface CromoViewProps {
  cromo: CromoDetail;
  prev: NeighborRef | null;
  next: NeighborRef | null;
  // "modal": abierto desde el álbum vía intercepting route. Cerrar = volver atrás (preserva álbum).
  // "page": URL canónica/compartible (full page). Cerrar = ir al álbum.
  mode: "modal" | "page";
}

export default function CromoView({ cromo, prev, next, mode }: CromoViewProps) {
  const router = useRouter();

  const onClose =
    mode === "modal"
      ? () => router.back()
      : () => router.push("/cromos");

  // En page-mode no exponemos prev/next: la URL es canónica y la
  // navegación entre cromos es contextual del álbum (modal-mode).
  const onPrev =
    mode === "modal" && prev
      ? () => router.replace(`/cromos/${prev.idSlug}`)
      : undefined;
  const onNext =
    mode === "modal" && next
      ? () => router.replace(`/cromos/${next.idSlug}`)
      : undefined;

  return (
    <CromoModal
      cromo={cromo}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
}

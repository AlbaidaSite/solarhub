import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CromoView from "../components/CromoView";
import { fetchCromoWithNeighbors } from "../lib/cromos-fetch";

interface PageProps {
  params: Promise<{ idSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { idSlug } = await params;
  const data = await fetchCromoWithNeighbors(idSlug);
  if (!data) return { title: "Cromo | SolarHub" };
  return {
    title: `${data.cromo.name} | SolarHub`,
    description: data.cromo.description ?? undefined,
  };
}

// Página completa para el cromo. Sólo se monta en hard nav (refresh,
// share, click sobre "Ir a Cromo" del registrar). En soft nav desde
// el álbum la intercepting route lo eclipsa con la versión modal.
export default async function CromoFullPage({ params }: PageProps) {
  const { idSlug } = await params;
  const data = await fetchCromoWithNeighbors(idSlug);
  if (!data) notFound();

  return (
    <CromoView
      cromo={data.cromo}
      prev={data.prev}
      next={data.next}
      mode="page"
    />
  );
}

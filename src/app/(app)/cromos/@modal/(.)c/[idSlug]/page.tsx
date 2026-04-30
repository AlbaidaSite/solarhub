import CromoView from "../../../components/CromoView";
import { fetchCromoWithNeighbors } from "../../../lib/cromos-fetch";

interface PageProps {
  params: Promise<{ idSlug: string }>;
}

// Intercepting route: cuando el usuario hace soft-nav desde dentro de
// /cromos a /cromos/<id>-<slug>, esto se renderiza en el slot @modal
// y `children` mantiene el álbum tal cual (modal por encima).
//
// Si por algún motivo el cromo no existe o el slug no encaja, devolvemos
// null (modal vacío) — el álbum sigue visible. La ruta canónica es
// /cromos/[idSlug]/page.tsx, que sí lanza notFound() en hard nav.
export default async function InterceptedCromoModal({ params }: PageProps) {
  const { idSlug } = await params;
  const data = await fetchCromoWithNeighbors(idSlug);
  if (!data) return null;

  return (
    <CromoView
      cromo={data.cromo}
      prev={data.prev}
      next={data.next}
      mode="modal"
    />
  );
}

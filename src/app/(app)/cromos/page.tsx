import type { Metadata } from 'next';
import Album from './components/Album';
import RegisterCromoButton from './components/RegisterCromoButton';
import IntercambiosButton from './components/IntercambiosButton';

export const metadata: Metadata = {
  title: 'Cromos | SolarHub',
  description: 'Colección de cromos de la comunidad solar',
};

export default function CromosPage() {
  return (
    <div className="relative w-full">
      {/* Desktop: botones apilados arriba-derecha (InterCard encima, Register debajo).
          La versión móvil vive en AlbumFilters dentro del wrapper fijo. */}
      <div className="hidden nav:flex flex-col items-center absolute top-0 right-0 z-10">
        <IntercambiosButton className="inline-flex" />
        <RegisterCromoButton className="inline-flex" />
      </div>

      <Album />
    </div>
  );
}

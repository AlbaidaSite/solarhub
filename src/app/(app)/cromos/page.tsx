import type { Metadata } from 'next';
import Album from './components/Album';
import RegisterCromoButton from './components/RegisterCromoButton';

export const metadata: Metadata = {
  title: 'Cromos | SolarHub',
  description: 'Colección de cromos de la comunidad solar',
};

export default function CromosPage() {
  return (
    <div className="relative w-full">
      {/* Solo visible en desktop. La versión móvil se renderiza dentro de
          AlbumFilters, debajo del botón embudo. */}
      <RegisterCromoButton className="hidden nav:inline-flex absolute top-0 right-0 z-10" />

      <Album />
    </div>
  );
}

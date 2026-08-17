import { Footer } from '@/components/Footer';
import HomeMenu from './components/HomeMenu';

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      {/* El menú de constelaciones ES el contenido de la portada, así que
          no lleva título a la vista; uno oculto le da nombre a la página. */}
      <h1 className="sr-only">SolarHub</h1>
      <HomeMenu />
      <Footer />
    </div>
  );
}

import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <h1>Página de inicio de SolarHub</h1>
      </div>
      <Footer />
    </div>
  );
}
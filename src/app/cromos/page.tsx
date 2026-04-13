import type { Metadata } from "next";
import Album from './components/Album';

export const metadata: Metadata = {
  title: "Cromos | SolarHub",
  description: "Colección de cromos de la comunidad solar",
};

export default function CromosPage() {
  return <Album />;
}
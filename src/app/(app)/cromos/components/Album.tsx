'use client';

import CromoCard from "./CromoCard";
import type { Cromo, User } from "@/types/cromo";

// TODO: reemplazar por fetch real cuando se conecte con backend
const MOCK_CROMOS: Cromo[] = [
  { id: 1, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 2, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 3, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 4, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 5, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 6, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 7, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 8, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
  { id: 9, name: "Prueba", front_img: "https://i.imgur.com/BpGTZ9D.png" },
];

const MOCK_USER: User = { id: 1, name: "Usuario de Prueba" };

export default function Album() {
  const cromos = MOCK_CROMOS;
  const user = MOCK_USER;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 p-4">
      {cromos.map((cromo) => (
        <CromoCard key={cromo.id} cromo={cromo} user={user} />
      ))}
    </div>
  );
}
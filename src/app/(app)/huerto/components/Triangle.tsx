interface TriangleProps {
  direction: "left" | "right";
}

// Mismo glifo que el paginador de cromos (src/components/ui/Pagination.tsx)
// y el calendario (eventos/components/Triangle.tsx), para mantener el mismo
// lenguaje visual de navegación en toda la app.
export default function Triangle({ direction }: TriangleProps) {
  const d = direction === "left" ? "M15 4 L6 12 L15 20 Z" : "M9 4 L18 12 L9 20 Z";
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

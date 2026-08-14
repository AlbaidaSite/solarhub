import PlantRow from "./PlantRow";
import type { Plant } from "@/types/garden";

interface PlantGroupListProps {
  title: string;
  plants: Plant[];
  onPlantSelect?: (plantId: number) => void;
  onPlantDragStart?: (plant: Plant, event: React.PointerEvent) => void;
}

// La cabecera se muestra siempre, incluso vacía: ocultarla haría que el
// bloque saltara de altura al cambiar de mes.
export default function PlantGroupList({
  title,
  plants,
  onPlantSelect,
  onPlantDragStart,
}: PlantGroupListProps) {
  return (
    <section>
      <h3 className="text-lg font-bold mb-2">{title}:</h3>
      {plants.length === 0 ? (
        <p className="text-white/40 text-sm">Ninguno</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {plants.map((plant) => (
            <PlantRow
              key={plant.id}
              plant={plant}
              onSelect={onPlantSelect}
              onDragStart={onPlantDragStart}
            />
          ))}
        </div>
      )}
    </section>
  );
}

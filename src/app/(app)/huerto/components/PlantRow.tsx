"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { Plant } from "@/types/garden";

// Cuanto hay que mantener el dedo para que el toque deje de significar "abrir
// la ficha" y pase a "plantar este cultivo". Por debajo del umbral con el que
// iOS saca su propio menu de imagen (~500ms), para llegar antes que el.
const LONG_PRESS_MS = 400;

// Si el dedo se mueve mas que esto antes de cumplirse el tiempo, no era una
// pulsacion: era un scroll de la lista. Se cancela y el toque sigue su curso
// normal, que es justo lo que hace falta para llegar a Recogida y Otros.
const LONG_PRESS_TOLERANCE = 10;

interface PlantRowProps {
  plant: Plant;
  onSelect?: (plantId: number) => void;
  // Presente solo cuando el icono se puede arrastrar hasta un bancal
  // (escritorio y con permiso de edición). Con arrastre activo el clic
  // NO se resuelve aquí: quien arrastra distingue clic de arrastre por el
  // recorrido del puntero y llama a onSelect él mismo (ver HuertoView).
  onDragStart?: (plant: Plant, event: React.PointerEvent) => void;
  // La contraparte tactil del arrastre: en movil no hay donde arrastrar
  // (panel y lienzo son pestañas), asi que mantener pulsado deja el cultivo
  // a la espera de que se toque un bancal. Nunca llega a la vez que
  // onDragStart: cada una vive en un tamaño de pantalla.
  onLongPress?: (plantId: number) => void;
}

export default function PlantRow({ plant, onSelect, onDragStart, onLongPress }: PlantRowProps) {
  const draggable = onDragStart != null;

  // Pulsacion en curso: su temporizador y el punto donde empezo, para poder
  // cancelarla si el dedo se va. Vive en un ref porque nada de esto se pinta.
  const pendingRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  // La pulsacion ya se cumplio. Al levantar el dedo llega un `click` que
  // abriria la ficha encima del modo que se acaba de iniciar.
  const firedRef = useRef(false);

  const cancelLongPress = () => {
    if (pendingRef.current) {
      window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
  };

  // Desmontar con una pulsacion a medias (cambio de mes, por ejemplo) dejaria
  // el temporizador vivo apuntando a un componente que ya no existe.
  useEffect(() => cancelLongPress, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    firedRef.current = false;
    // Con raton no: ahi el gesto equivalente es arrastrar, y mantener pulsado
    // sin querer al hacer clic es demasiado facil.
    if (!onLongPress || e.pointerType === "mouse") return;
    const { clientX: x, clientY: y } = e;
    const timer = window.setTimeout(() => {
      pendingRef.current = null;
      firedRef.current = true;
      // El icono desaparece de pantalla al cambiar de pestaña, asi que la
      // vibracion es lo unico que confirma que el gesto ha prendido.
      navigator.vibrate?.(15);
      onLongPress(plant.id);
    }, LONG_PRESS_MS);
    pendingRef.current = { timer, x, y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > LONG_PRESS_TOLERANCE) {
      cancelLongPress();
    }
  };

  return (
    <button
      type="button"
      onPointerDown={draggable ? (e) => onDragStart(plant, e) : handlePointerDown}
      onPointerMove={draggable ? undefined : handlePointerMove}
      onPointerUp={draggable ? undefined : cancelLongPress}
      onPointerCancel={draggable ? undefined : cancelLongPress}
      onClick={
        draggable
          ? undefined
          : (e: React.MouseEvent) => {
              // La pulsacion larga ya decidio: este clic es el rebote de
              // levantar el dedo, no una peticion de abrir la ficha.
              if (firedRef.current) {
                firedRef.current = false;
                e.stopPropagation();
                return;
              }
              onSelect?.(plant.id);
            }
      }
      // Mantener pulsado sobre una imagen saca el menu del sistema ("guardar
      // imagen") y el selector de texto, que se comen el gesto.
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      title={plant.name}
      aria-label={plant.name}
      // Sin touch-none cuando hay pulsacion larga: es lo que deja que un
      // deslizamiento sobre un icono siga desplazando la lista. El gesto no lo
      // necesita, porque se resuelve con el dedo quieto.
      className={`relative w-14 h-14 shrink-0 ${
        draggable ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${onLongPress ? "select-none [-webkit-touch-callout:none]" : ""}`}
    >
      <Image
        src={plant.icon_path}
        alt={plant.name}
        fill
        sizes="56px"
        className="object-contain"
        // Sin esto el navegador inicia su propio arrastre nativo de
        // imagen al mantener pulsado, que se come los eventos de puntero.
        draggable={false}
      />
    </button>
  );
}

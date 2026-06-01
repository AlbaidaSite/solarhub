import type { ReactNode } from "react";
import StaffBackButton from "./StaffBackButton";

interface StaffPageShellProps {
  title: ReactNode;
  backHref?: string;
  backLabel?: string;
  // Si se proporciona, se renderiza entre el título y los children.
  // El llamante controla su layout (flex/justify) según convenga.
  actions?: ReactNode;
  // "list" usa gap-6; "form" centra el contenido con items-center gap-8.
  variant?: "list" | "form";
  children: ReactNode;
}

// Layout estándar de las páginas de staff: back button arriba-izquierda,
// título centrado y un slot opcional para la barra de acciones.
export default function StaffPageShell({
  title,
  backHref,
  backLabel,
  actions,
  variant = "list",
  children,
}: StaffPageShellProps) {
  const containerClass =
    variant === "form"
      ? "relative w-full min-h-full p-6 flex flex-col items-center gap-8"
      : "relative w-full min-h-full p-6 flex flex-col gap-6";

  return (
    <div className={containerClass}>
      <div className="absolute top-4 left-4">
        <StaffBackButton href={backHref} label={backLabel} />
      </div>
      <h1 className="text-3xl font-bold text-white text-center mt-12">
        {title}
      </h1>
      {actions}
      {children}
    </div>
  );
}

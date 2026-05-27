"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

// Wrapper alineado a la derecha para la columna "Acciones" de AdminTable.
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2">{children}</div>
  );
}

interface EditLinkProps {
  href: string;
  label?: string;
}

export function EditLink({ href, label = "Editar" }: EditLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="p-1.5 rounded-lg text-white/50 hover:text-amber-300 hover:bg-white/5 transition-colors"
    >
      <Pencil size={16} strokeWidth={2} />
    </Link>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  label?: string;
}

export function DeleteButton({ onClick, label = "Eliminar" }: DeleteButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
    >
      <Trash2 size={16} strokeWidth={2} />
    </button>
  );
}

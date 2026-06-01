"use client";

import type { ReactNode } from "react";

export interface ColumnDef<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  // Clase opcional para la celda <th>/<td> (anchura, tabular-nums, etc.).
  className?: string;
}

interface AdminTableProps<T> {
  rows: T[];
  getRowKey: (row: T) => string | number;
  columns: ColumnDef<T>[];
  // Render del bloque de iconos de la columna "Acciones" (editar/borrar/…).
  // Si se omite, no se añade columna de acciones.
  rowActions?: (row: T) => ReactNode;
  emptyMessage: string;
  // Permite a la fila aplicar clases extra (p.ej. opacidad para inactivos).
  rowClassName?: (row: T) => string;
}

const ALIGN_CLASS: Record<NonNullable<ColumnDef<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

// Tabla genérica de administración: contenedor + cabecera + filas + estado
// vacío. La lógica específica (state, acciones, modales) la conserva el
// componente padre; AdminTable solo presenta.
export default function AdminTable<T>({
  rows,
  getRowKey,
  columns,
  rowActions,
  emptyMessage,
  rowClassName,
}: AdminTableProps<T>) {
  return (
    <div className="rounded-xl border border-white/15 overflow-hidden">
      <table className="w-full text-sm text-white">
        <thead className="bg-white/10 text-white/60 uppercase text-xs">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3 ${ALIGN_CLASS[col.align ?? "left"]} ${
                  col.className ?? ""
                }`}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <th className="px-4 py-3 text-right">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => {
            const customRowClass = rowClassName?.(row);
            const trClass = customRowClass
              ? `${customRowClass} transition-colors`
              : "bg-black hover:bg-gray-800 transition-colors";
            return (
            <tr key={getRowKey(row)} className={trClass}>
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 ${ALIGN_CLASS[col.align ?? "left"]} ${
                    col.className ?? ""
                  }`}
                >
                  {col.cell(row)}
                </td>
              ))}
              {rowActions && <td className="px-4 py-3">{rowActions(row)}</td>}
            </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-white/40">{emptyMessage}</p>
      )}
    </div>
  );
}

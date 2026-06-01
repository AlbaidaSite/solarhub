"use client";

import { useState } from "react";
import AdminTable from "../../components/AdminTable";
import { DeleteButton, EditLink, RowActions } from "../../components/RowActions";
import { useConfirmDelete } from "../../components/useConfirmDelete";
import { deleteCromoAction } from "../actions";

interface CromoRow {
  id: number;
  name: string;
  number: number;
  variant: number;
  category: { name: string } | null;
}

export default function CromoAdminList({ cromos: initial }: { cromos: CromoRow[] }) {
  const [cromos, setCromos] = useState<CromoRow[]>(initial);

  const { openDelete, dialog } = useConfirmDelete<number>({
    itemLabel: "cromo",
    action: deleteCromoAction,
    onSuccess: (id) => setCromos((prev) => prev.filter((c) => c.id !== id)),
  });

  return (
    <>
      <AdminTable<CromoRow>
        rows={cromos}
        getRowKey={(c) => c.id}
        columns={[
          { header: "Nombre", cell: (c) => c.name },
          { header: "Categoría", cell: (c) => c.category?.name ?? "—" },
          {
            header: "Nº",
            cell: (c) => c.number,
            align: "center",
            className: "tabular-nums",
          },
          {
            header: "Variante",
            cell: (c) => c.variant,
            align: "center",
            className: "tabular-nums",
          },
        ]}
        rowActions={(c) => (
          <RowActions>
            <EditLink href={`/staff/cromos/${c.id}`} label="Editar cromo" />
            <DeleteButton onClick={() => openDelete(c.id)} label="Eliminar cromo" />
          </RowActions>
        )}
        emptyMessage="No hay cromos."
      />
      {dialog}
    </>
  );
}

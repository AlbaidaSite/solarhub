"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import AdminTable from "../../../components/AdminTable";
import {
  DeleteButton,
  EditLink,
  RowActions,
} from "../../../components/RowActions";
import { useConfirmDelete } from "../../../components/useConfirmDelete";
import { deleteArtistAction } from "../actions";

interface ArtistRow {
  id: number;
  name: string;
  url: string | null;
}

export default function ArtistAdminList({
  artists: initial,
}: {
  artists: ArtistRow[];
}) {
  const [artists, setArtists] = useState<ArtistRow[]>(initial);

  const { openDelete, dialog } = useConfirmDelete<number>({
    itemLabel: "artista",
    action: deleteArtistAction,
    onSuccess: (id) => setArtists((prev) => prev.filter((a) => a.id !== id)),
  });

  return (
    <>
      <AdminTable<ArtistRow>
        rows={artists}
        getRowKey={(a) => a.id}
        columns={[
          { header: "Nombre", cell: (a) => a.name },
          {
            header: "URL",
            cell: (a) =>
              a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline"
                >
                  {a.url.length > 40 ? `${a.url.slice(0, 40)}…` : a.url}
                  <ExternalLink size={12} />
                </a>
              ) : (
                "—"
              ),
          },
        ]}
        rowActions={(a) => (
          <RowActions>
            <EditLink
              href={`/staff/cromos/artistas/${a.id}`}
              label="Editar artista"
            />
            <DeleteButton
              onClick={() => openDelete(a.id)}
              label="Eliminar artista"
            />
          </RowActions>
        )}
        emptyMessage="No hay artistas."
      />
      {dialog}
    </>
  );
}

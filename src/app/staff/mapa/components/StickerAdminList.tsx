"use client";

import { useState } from "react";
import Image from "next/image";
import AdminTable from "../../components/AdminTable";
import { DeleteButton, EditLink, RowActions } from "../../components/RowActions";
import { useConfirmDelete } from "../../components/useConfirmDelete";
import { deleteStickerAction } from "../actions";

interface StickerRow {
  id: number;
  name: string;
  iconUrl: string;
}

export default function StickerAdminList({
  stickers: initial,
}: {
  stickers: StickerRow[];
}) {
  const [stickers, setStickers] = useState<StickerRow[]>(initial);

  const { openDelete, dialog } = useConfirmDelete<number>({
    itemLabel: "sticker",
    action: deleteStickerAction,
    onSuccess: (id) => setStickers((prev) => prev.filter((s) => s.id !== id)),
  });

  return (
    <>
      <AdminTable<StickerRow>
        rows={stickers}
        getRowKey={(s) => s.id}
        columns={[
          {
            header: "Icono",
            cell: (s) => (
              <div className="relative w-10 h-10 shrink-0">
                <Image
                  src={s.iconUrl}
                  alt={s.name}
                  fill
                  sizes="40px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            ),
            className: "w-14",
          },
          { header: "Nombre", cell: (s) => s.name },
        ]}
        rowActions={(s) => (
          <RowActions>
            <EditLink
              href={`/staff/mapa/stickers/${s.id}`}
              label="Editar sticker"
            />
            <DeleteButton
              onClick={() => openDelete(s.id)}
              label="Eliminar sticker"
            />
          </RowActions>
        )}
        emptyMessage="No hay stickers."
      />
      {dialog}
    </>
  );
}

// Reglas de visibilidad del álbum.
//   · RN-012 (cromos `for_loukou`): solo visibles para usuarios `is_loukou`,
//     PERO si el usuario ha tenido alguna copia, queda visible para siempre.
//   · RN-013 (cromos `hide_til_registered`): invisibles hasta que el usuario
//     haya registrado al menos una copia.
//   · Superuser ve todo (modo dios).
//
// Función pura aislada para que se pueda testear sin tocar Supabase. La
// usa `cromos-fetch.ts` al filtrar el listado del álbum.

export interface CromoVisibilityLabels {
  hide_til_registered: boolean;
  for_loukou: boolean;
}

export function isVisibleInAlbum(
  labels: CromoVisibilityLabels,
  hasEverOwned: boolean,
  isUserLoukou: boolean,
  isUserSuperuser: boolean,
): boolean {
  if (isUserSuperuser) return true;
  if (hasEverOwned) return true;
  if (labels.hide_til_registered) return false;
  if (labels.for_loukou && !isUserLoukou) return false;
  return true;
}

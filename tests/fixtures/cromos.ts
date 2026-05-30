// Fixtures de cromos para tests de visibilidad y propiedad.
//
// `cromoFor(labels)` construye un objeto con la forma mínima usada por
// `isVisibleInAlbum`. Los tests que necesiten más campos pueden extender.

import type { CromoVisibilityLabels } from "@/app/(app)/cromos/lib/visibility";

export const labelsAbierto: CromoVisibilityLabels = {
  hide_til_registered: false,
  for_loukou: false,
};

export const labelsForLoukou: CromoVisibilityLabels = {
  hide_til_registered: false,
  for_loukou: true,
};

export const labelsHidden: CromoVisibilityLabels = {
  hide_til_registered: true,
  for_loukou: false,
};

export const labelsForLoukouHidden: CromoVisibilityLabels = {
  hide_til_registered: true,
  for_loukou: true,
};

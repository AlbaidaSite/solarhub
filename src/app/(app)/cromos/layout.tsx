import type { ReactNode } from "react";

// Layout con slot paralelo `@modal` para soportar intercepting routes:
//   · Soft nav `/cromos` → `/cromos/<id>-<slug>` activa @modal/(.)[idSlug]
//     y mantiene el álbum montado en `children` (modal sobre álbum).
//   · Hard nav (refresh, share, "Ir a Cromo" del registrar) resuelve
//     `/cromos/[idSlug]/page.tsx` en `children`; @modal cae a default (null).
export default function CromosLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}

import type { ReactNode } from "react";
import { StarBackground } from "@/components/StarBackground";

// Layout aislado: vive fuera de (app) y (auth), así no arrastra navbar
// ni footer. Sólo el fondo estrellado para mantener el tema visual.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-black relative overflow-hidden">
      <StarBackground />
      <main className="relative z-10 h-full overflow-y-auto">{children}</main>
    </div>
  );
}

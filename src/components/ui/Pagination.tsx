"use client";

interface PaginationProps {
  /** Página actual (1-based). */
  currentPage: number;
  /** Número total de páginas. */
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Ventana de páginas a mostrar: todas si son pocas; si no, primera + última
// + un entorno de la actual, con elipsis para los huecos.
function getPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return range(1, total);
  if (current <= 4) return [...range(1, 5), "…", total];
  if (current >= total - 3) return [1, "…", ...range(total - 4, total)];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

function Triangle({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M15 4 L6 12 L15 20 Z" : "M9 4 L18 12 L9 20 Z";
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  // Sin suficientes elementos para paginar: no se muestran las flechas.
  if (totalPages <= 1) return null;

  const goTo = (p: number) => onPageChange(Math.min(totalPages, Math.max(1, p)));
  const items = getPageItems(currentPage, totalPages);

  const arrowClass =
    "text-white transition-colors hover:text-amber-300 disabled:opacity-30 disabled:hover:text-white disabled:cursor-default cursor-pointer";

  return (
    <nav
      aria-label="Paginación"
      className={`flex items-center justify-center gap-4 py-8 ${className}`}
    >
      <button
        type="button"
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Página anterior"
        className={arrowClass}
      >
        <Triangle direction="left" />
      </button>

      <span aria-hidden className="text-white/30 select-none">
        •
      </span>

      <ol className="flex items-center gap-3">
        {items.map((item, i) =>
          item === "…" ? (
            <li key={`gap-${i}`} aria-hidden className="text-white/30 select-none">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => goTo(item)}
                aria-current={item === currentPage ? "page" : undefined}
                className={`cursor-pointer transition-colors leading-none ${
                  item === currentPage
                    ? "text-2xl font-bold text-white"
                    : "text-base text-white/50 hover:text-white/90"
                }`}
              >
                {item}
              </button>
            </li>
          )
        )}
      </ol>

      <span aria-hidden className="text-white/30 select-none">
        •
      </span>

      <button
        type="button"
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Página siguiente"
        className={arrowClass}
      >
        <Triangle direction="right" />
      </button>
    </nav>
  );
}

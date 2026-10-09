"use client";

import { Select } from "@/components/ui/Select";

/**
 * Paginação numerada com reticências.
 * Só "Anterior/Próxima" obriga a clicar N vezes para chegar ao fim — com
 * 11 páginas de pacientes isso é inviável no balcão.
 */

export function Pagination({
  page,
  pages,
  total,
  perPage,
  onChange,
  onPerPageChange,
  label = "itens",
}: {
  page: number;
  pages: number;
  total: number;
  perPage?: number;
  onChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  label?: string;
}) {
  if (pages <= 1 && !onPerPageChange) return null;

  const from = (page - 1) * (perPage ?? 0) + 1;
  const to = Math.min(total, page * (perPage ?? total));

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <p className="text-sm text-[var(--color-ink-muted)]">
        {perPage ? (
          <>
            <span className="tabular font-medium text-[var(--color-ink)]">
              {from}–{to}
            </span>{" "}
            de <span className="tabular">{total}</span> {label}
          </>
        ) : (
          <>
            <span className="tabular">{total}</span> {label}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPerPageChange && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <span className="hidden sm:inline">Por página</span>
            <Select
              label="Itens por página"
              size="sm"
              className="w-[84px]"
              value={String(perPage)}
              onChange={(v) => onPerPageChange(Number(v))}
              options={[12, 24, 48, 96].map((n) => ({
                value: String(n),
                label: String(n),
              }))}
            />
          </label>
        )}

        {pages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Paginação">
            <PageButton
              onClick={() => onChange(1)}
              disabled={page === 1}
              label="Primeira página"
            >
              «
            </PageButton>
            <PageButton
              onClick={() => onChange(page - 1)}
              disabled={page === 1}
              label="Página anterior"
            >
              ‹
            </PageButton>

            {pageWindow(page, pages).map((item, i) =>
              item === "…" ? (
                <span
                  key={`gap-${i}`}
                  className="px-1 text-sm text-[var(--color-ink-subtle)]"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onChange(item)}
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Página ${item}`}
                  className={`tabular h-8 min-w-8 rounded-[9px] px-2 font-[family-name:var(--font-mono)] text-xs transition-colors ${
                    item === page
                      ? "bg-[var(--color-accent)] font-medium text-white"
                      : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}

            <PageButton
              onClick={() => onChange(page + 1)}
              disabled={page === pages}
              label="Próxima página"
            >
              ›
            </PageButton>
            <PageButton
              onClick={() => onChange(pages)}
              disabled={page === pages}
              label="Última página"
            >
              »
            </PageButton>
          </nav>
        )}
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-[9px] text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Janela deslizante: 1 … 4 [5] 6 … 20 */
function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);

  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("…");
  out.push(pages);

  return out;
}

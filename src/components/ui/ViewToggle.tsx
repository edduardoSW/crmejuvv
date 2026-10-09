"use client";

/**
 * Alternador cards / lista.
 * Card é o padrão em todas as telas de listagem; a lista é a opção densa,
 * para quem quer comparar muitos registros de uma vez.
 */

import { IconDashboard, IconRecord } from "@/components/icons";

export type ViewMode = "cards" | "lista";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const OPTIONS = [
    { id: "cards" as const, label: "Cards", icon: <IconDashboard width={15} height={15} /> },
    { id: "lista" as const, label: "Lista", icon: <IconRecord width={15} height={15} /> },
  ];

  return (
    <div className="segmented" role="radiogroup" aria-label="Modo de exibição">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            value === option.id
              ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
              : "text-[var(--color-ink-muted)]"
          }`}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

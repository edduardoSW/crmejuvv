"use client";

/** Aparência: tema, paleta de cor e tamanho de fonte. Preferência pessoal. */

import {
  useTheme,
  PALETTES,
  FONT_SCALES,
  type ThemeChoice,
} from "@/components/providers/ThemeProvider";
import { IconCheck } from "@/components/icons";

const THEMES: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: "light", label: "Claro", hint: "Fundo claro, para o dia a dia" },
  { id: "dark", label: "Escuro", hint: "Menos brilho à noite" },
];

export function AppearanceSettings() {
  const { theme, palette, font, setTheme, setPalette, setFont } = useTheme();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ------------------------------------------------------ tema */}
      <section className="card p-6">
        <h2>Tema</h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
          Vale para este navegador.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
              className={`rounded-[14px] border-2 p-3 text-left transition-all ${
                theme === t.id
                  ? "border-[var(--color-accent)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
              }`}
            >
              <span
                className="mb-2.5 flex h-14 w-full items-end gap-1 overflow-hidden rounded-[9px] p-1.5"
                style={{
                  background: t.id === "light" ? "#FDFBFA" : "#17130F",
                  border: "1px solid var(--color-line)",
                }}
                aria-hidden="true"
              >
                <span
                  className="h-6 w-1/3 rounded"
                  style={{ background: t.id === "light" ? "#F7F1EE" : "#2A2320" }}
                />
                <span
                  className="h-9 flex-1 rounded"
                  style={{ background: t.id === "light" ? "#FFFFFF" : "#201A17" }}
                />
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t.label}
                {theme === t.id && (
                  <IconCheck width={14} height={14} className="text-[var(--color-accent)]" />
                )}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
                {t.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- paleta */}
      <section className="card p-6">
        <h2>Cores</h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
          A paleta vale para todo o sistema.
        </p>

        <div className="mt-5 space-y-3">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              aria-pressed={palette === p.id}
              className={`flex w-full items-center gap-3.5 rounded-[14px] border-2 p-3 text-left transition-all ${
                palette === p.id
                  ? "border-[var(--color-accent)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
              }`}
            >
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                {p.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-8 w-4 rounded-[4px]"
                    style={{ background: c, border: "1px solid rgb(0 0 0 / .08)" }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {p.label}
                  {palette === p.id && (
                    <IconCheck width={14} height={14} className="text-[var(--color-accent)]" />
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
                  {p.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- fonte */}
      <section className="card p-6 lg:col-span-2">
        <h2>Tamanho da fonte</h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
          Aumenta o texto e o espaçamento juntos. O layout continua se
          adaptando à largura da tela.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {FONT_SCALES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFont(f.id)}
              aria-pressed={font === f.id}
              className={`btn btn-sm ${font === f.id ? "btn-primary" : "btn-outline"}`}
            >
              <span style={{ fontSize: `${0.75 + (f.value - 0.9) * 0.9}rem` }}>A</span>
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
          <p className="overline">Prévia</p>
          <p className="mt-2 text-sm">
            Sessão de <strong>Mariana Ribeiro</strong> hoje às 14:00 com Ana
            Paula Vieira · Petrobras.
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Este texto usa o tamanho que você escolheu acima.
          </p>
        </div>
      </section>
    </div>
  );
}

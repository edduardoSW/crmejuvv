"use client";

import { useState } from "react";

/**
 * Gráficos em SVG próprio — sem biblioteca (stack-padrao do vault).
 * Todos respondem ao tema porque usam as CSS vars, não cores fixas.
 */

export interface Serie {
  label: string;
  value: number;
  secondary?: number;
  color?: string;
}

const fmtShort = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",")}k` : String(Math.round(v));

/* ------------------------------------------------------- barras empilhadas */

export function StackedBars({
  data,
  primaryLabel,
  secondaryLabel,
  height = 200,
  formatValue = fmtShort,
}: {
  data: Serie[];
  primaryLabel: string;
  secondaryLabel?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value + (d.secondary ?? 0)), 1);

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => {
          const total = d.value + (d.secondary ?? 0);
          return (
            <div
              key={d.label}
              className="group flex flex-1 flex-col items-center justify-end gap-2"
              style={{ height: "100%" }}
            >
              <span className="tabular text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                {formatValue(total)}
              </span>
              <div className="flex w-full flex-col justify-end gap-0.5" style={{ height: "100%" }}>
                {d.secondary !== undefined && d.secondary > 0 && (
                  <div
                    className="w-full rounded-t-[6px] transition-all"
                    style={{
                      height: `${(d.secondary / max) * 100}%`,
                      background: "var(--color-danger-soft)",
                    }}
                    title={`${secondaryLabel}: ${d.secondary}`}
                  />
                )}
                <div
                  className="w-full rounded-t-[6px] transition-all group-hover:brightness-105"
                  style={{
                    height: `${(d.value / max) * 100}%`,
                    background: d.color ?? "var(--color-accent)",
                    borderRadius: d.secondary ? "0 0 4px 4px" : "6px 6px 4px 4px",
                  }}
                  title={`${primaryLabel}: ${d.value}`}
                />
              </div>
              <span className="overline">{d.label}</span>
            </div>
          );
        })}
      </div>
      <Legend
        items={[
          { label: primaryLabel, color: "var(--color-accent)" },
          ...(secondaryLabel
            ? [{ label: secondaryLabel, color: "var(--color-danger-soft)" }]
            : []),
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------ área/linha */

export function AreaChart({
  data,
  height = 180,
  formatValue = fmtShort,
}: {
  data: Serie[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (data.length < 2) return <ChartEmpty />;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;
  const W = 100;
  const H = 40;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.value - min) / span) * H,
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height }}
        role="img"
        aria-label="Evolução no período"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex justify-between">
        {data.map((d) => (
          <span key={d.label} className="overline">
            {d.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
        Máximo no período: <strong className="tabular">{formatValue(max)}</strong>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

export function Donut({
  data,
  centerLabel,
  centerValue,
  formatValue,
}: {
  data: Serie[];
  centerLabel: string;
  /** Já formatado — some quando um segmento está em foco. */
  centerValue: string;
  /** Usado no rótulo do segmento em foco. */
  formatValue?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <ChartEmpty />;

  const PALETTE = [
    "var(--color-accent)",
    "var(--color-gold)",
    "var(--color-info)",
    "var(--color-success)",
    "var(--color-warn)",
  ];

  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const focused = active !== null ? data[active] : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg
          width="152"
          height="152"
          viewBox="0 0 100 100"
          role="img"
          aria-label={centerLabel}
          onMouseLeave={() => setActive(null)}
        >
          <g transform="rotate(-90 50 50)">
            {data.map((d, i) => {
              const share = d.value / total;
              const dash = share * C;
              const isActive = active === i;
              const el = (
                <circle
                  key={d.label}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={d.color ?? PALETTE[i % PALETTE.length]}
                  /* O segmento em foco engrossa para fora, sem mexer no raio —
                     assim os vizinhos não deslocam. */
                  strokeWidth={isActive ? 17 : 12}
                  strokeDasharray={`${Math.max(0, dash - 0.6)} ${C - dash + 0.6}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={active === null || isActive ? 1 : 0.35}
                  style={{
                    transition: "stroke-width 160ms var(--ease-out-expo), opacity 160ms",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(active === i ? null : i)}
                />
              );
              offset += dash;
              return el;
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-content-center px-6 text-center">
          {focused ? (
            <>
              <span className="tabular block font-[family-name:var(--font-mono)] text-lg leading-none">
                {((focused.value / total) * 100).toFixed(0)}%
              </span>
              <span className="mt-1 block max-w-[76px] truncate text-[10px] text-[var(--color-ink-muted)]">
                {focused.label}
              </span>
            </>
          ) : (
            <>
              <span className="tabular block max-w-[80px] truncate font-[family-name:var(--font-mono)] text-[0.8125rem] leading-none">
                {centerValue}
              </span>
              <span className="mt-1 block text-[10px] text-[var(--color-ink-muted)]">
                {centerLabel}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1">
        {data.map((d, i) => (
          <li key={d.label}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
              className={`flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-sm transition-colors ${
                active === i ? "bg-[var(--color-surface-2)]" : ""
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px] transition-transform"
                style={{
                  background: d.color ?? PALETTE[i % PALETTE.length],
                  transform: active === i ? "scale(1.35)" : undefined,
                }}
              />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="tabular shrink-0 text-[var(--color-ink-muted)]">
                {active === i && formatValue
                  ? formatValue(d.value)
                  : `${((d.value / total) * 100).toFixed(0)}%`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ barra horiz. */

export function RankBars({
  data,
  formatValue = fmtShort,
}: {
  data: Serie[];
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{d.label}</span>
            <span className="tabular shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
              {formatValue(d.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ?? "var(--color-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ apoio */

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--color-line)] pt-3 text-xs">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="grid h-40 place-items-center rounded-[12px] border border-dashed border-[var(--color-line-strong)]">
      <p className="text-sm text-[var(--color-ink-muted)]">
        Sem dados suficientes no período.
      </p>
    </div>
  );
}

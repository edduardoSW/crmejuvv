"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo } from "@/lib/repository";
import { AreaChart, Donut, RankBars, StackedBars } from "@/components/ui/Charts";
import { brl, brlCompact, monthLabel, pct } from "@/lib/format";
import type { Overview, ProfessionalStats } from "@/lib/repository/local/reports";
import type { PlanSummary } from "@/lib/repository/local/finance";
import { hasPermission } from "@/lib/domain/types";

const TODAY = new Date(2026, 7, 17, 23, 59);
type Range = "mes" | "trimestre" | "semestre";

const RANGES: { id: Range; label: string; months: number }[] = [
  { id: "mes", label: "Este mês", months: 1 },
  { id: "trimestre", label: "3 meses", months: 3 },
  { id: "semestre", label: "6 meses", months: 6 },
];

export default function RelatoriosPage() {
  const { scope, revision, isSolo } = useApp();
  const [range, setRange] = useState<Range>("trimestre");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [byPro, setByPro] = useState<ProfessionalStats[]>([]);
  const [series, setSeries] = useState<{ month: string; attended: number; no_show: number; revenue: number }[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  const load = useCallback(async () => {
    if (!scope) return;
    const months = RANGES.find((r) => r.id === range)!.months;
    const from = new Date(TODAY);
    from.setMonth(from.getMonth() - (months - 1));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const period = { from: from.toISOString(), to: TODAY.toISOString() };

    const [ov, sr] = await Promise.all([
      repo.reports.overview(scope, period),
      repo.reports.monthlySeries(scope, period),
    ]);
    setOverview(ov);
    setSeries(sr);

    if (hasPermission(scope, "report.read.all")) {
      setByPro(await repo.reports.byProfessional(scope, period));
    }
    if (hasPermission(scope, "finance.read.all")) {
      setPlans(await repo.finance.summaryByPlan(scope, { from: period.from, to: period.to }));
    }
  }, [scope, range]);

  useEffect(() => { load(); }, [load, revision]);

  if (!scope) return null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">Gestão</p>
          <h1 className="mt-3">Relatórios</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            Como andam atendimentos, faltas e faturamento.
          </p>
        </div>
        <div className="segmented">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                range === r.id
                  ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {overview && (
        <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Metric label="Atendimentos" value={String(overview.attendances)} delta={overview.attendances_delta} />
          <Metric label="Receita" value={brl(overview.revenue)} delta={overview.revenue_delta} />
          <Metric label="Taxa de faltas" value={pct(overview.no_show_rate)} delta={overview.no_show_delta} inverse />
          <Metric label="Ocupação" value={pct(overview.occupancy, 0)} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-6">
          <h2>Atendimentos e faltas</h2>
          <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Por mês</p>
          <StackedBars
            data={series.map((s) => ({
              label: monthLabel(s.month), value: s.attended, secondary: s.no_show,
            }))}
            primaryLabel="Atendidas"
            secondaryLabel="Faltas"
          />
        </section>

        <section className="card p-6">
          <h2>Faturamento</h2>
          <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Recebido por mês</p>
          <AreaChart
            data={series.map((s) => ({ label: monthLabel(s.month), value: s.revenue }))}
            formatValue={brl}
          />
        </section>
      </div>

      {!isSolo && byPro.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <h2>Desempenho por profissional</h2>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Ocupação e falta por profissional.
            </p>
          </div>
          <div className="scroll-x">
            <table className="w-full text-sm">
              <caption className="sr-only">Desempenho por profissional</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th scope="col" className="overline px-5 py-3">Profissional</th>
                  <th scope="col" className="overline px-5 py-3">Agendadas</th>
                  <th scope="col" className="overline px-5 py-3">Atendidas</th>
                  <th scope="col" className="overline px-5 py-3">Faltas</th>
                  <th scope="col" className="overline px-5 py-3">Taxa de falta</th>
                  <th scope="col" className="overline px-5 py-3">Ocupação</th>
                  <th scope="col" className="overline px-5 py-3">Receita</th>
                </tr>
              </thead>
              <tbody>
                {byPro.map((p) => (
                  <tr key={p.professional_id} className="table-row">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="tabular px-5 py-3">{p.scheduled}</td>
                    <td className="tabular px-5 py-3">{p.attended}</td>
                    <td className="tabular px-5 py-3">{p.no_show}</td>
                    <td className="tabular px-5 py-3">
                      <span className={p.no_show_rate > 15 ? "text-[var(--color-danger)]" : ""}>
                        {pct(p.no_show_rate)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(100, p.occupancy)}%`, background: "var(--color-accent)" }} />
                        </div>
                        <span className="tabular text-xs text-[var(--color-ink-muted)]">
                          {pct(p.occupancy, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="tabular px-5 py-3">{brl(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {!isSolo && byPro.length > 0 && (
          <section className="card p-6">
            <h2>Volume por profissional</h2>
            <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Sessões atendidas no período</p>
            <RankBars data={byPro.map((p) => ({ label: p.name, value: p.attended }))} />
          </section>
        )}

        {plans.length > 0 && (
          <section className="card p-6">
            <h2>Receita por convênio</h2>
            <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Participação no período</p>
            <Donut
              data={plans.map((p) => ({ label: p.name, value: p.total }))}
              centerLabel="total"
              centerValue={brlCompact(plans.reduce((s, p) => s + p.total, 0))}
              formatValue={brl}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, delta, inverse }: { label: string; value: string; delta?: number; inverse?: boolean }) {
  const has = typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) >= 0.05;
  const good = has ? (inverse ? delta! < 0 : delta! > 0) : false;
  return (
    <div className="card p-5">
      <p className="overline">{label}</p>
      <p className="tabular mt-2 font-[family-name:var(--font-mono)] text-[1.5rem] leading-none">{value}</p>
      {has && (
        <p className={`mt-2 text-xs ${good ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
          {delta! > 0 ? "▲" : "▼"} {Math.abs(delta!).toFixed(1).replace(".", ",")}% vs. período anterior
        </p>
      )}
    </div>
  );
}

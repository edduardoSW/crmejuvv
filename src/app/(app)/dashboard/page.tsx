"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProvider";
import { repo } from "@/lib/repository";
import { readDatabase } from "@/lib/repository/store";
import { buildInsights, type Insight } from "@/lib/insights";
import { ASSISTANT_NAME } from "@/lib/assistant-identity";
import { AppointmentBadge } from "@/components/ui/Status";
import { AreaChart, Donut, RankBars, StackedBars } from "@/components/ui/Charts";
import { brl, brlCompact, dateLong, initials, monthLabel, pct, time } from "@/lib/format";
import { hasPermission } from "@/lib/domain/types";
import type { Appointment, Patient, Profile } from "@/lib/domain/types";
import type { Overview, ProfessionalStats } from "@/lib/repository/local/reports";
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCheck,
  IconMoney,
  IconPlus,
  IconSparkle,
  IconUsers,
} from "@/components/icons";

const TODAY = new Date(2026, 7, 17, 12, 0, 0);

export default function DashboardPage() {
  const { scope, profile, role, revision, isSolo } = useApp();
  const [state, setState] = useState<{
    overview: Overview;
    series: { month: string; attended: number; no_show: number; revenue: number }[];
    today: Appointment[];
    byProfessional: ProfessionalStats[];
    planSummary: { name: string; value: number }[];
    insights: Insight[];
    people: Profile[];
    patients: Map<string, Patient>;
    pending: { reminders: number; glosas: number; glosaValue: number };
  } | null>(null);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;

    (async () => {
      const monthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
      const sixAgo = new Date(TODAY);
      sixAgo.setMonth(sixAgo.getMonth() - 5);
      sixAgo.setDate(1);

      const dayStart = new Date(TODAY);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(TODAY);
      dayEnd.setHours(23, 59, 59, 999);

      const period = { from: monthStart.toISOString(), to: TODAY.toISOString() };

      const [overview, series, today, people] = await Promise.all([
        repo.reports.overview(scope, period),
        repo.reports.monthlySeries(scope, {
          from: sixAgo.toISOString(),
          to: TODAY.toISOString(),
        }),
        repo.appointments.list(scope, {
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
        }),
        repo.team.listProfessionals(scope),
      ]);

      const byProfessional = hasPermission(scope, "report.read.all")
        ? await repo.reports.byProfessional(scope, period)
        : [];

      const planSummary = hasPermission(scope, "finance.read.all")
        ? (await repo.finance.summaryByPlan(scope, period)).map((p) => ({
            name: p.name,
            value: p.total,
          }))
        : [];

      // Insights e pendências leem a base direto (só metadados, nunca conteúdo).
      const db = readDatabase();
      const orgAppointments = db.appointments.filter(
        (a) => a.org_id === scope.org_id,
      );
      const orgEntries = db.financial_entries.filter(
        (e) => e.org_id === scope.org_id,
      );
      const orgPatients = db.patients.filter((p) => p.org_id === scope.org_id);

      const insights = buildInsights({
        today: TODAY,
        appointments: orgAppointments,
        entries: orgEntries,
        patients: orgPatients,
        professionals: people,
        plans: db.health_plans.filter((p) => p.org_id === scope.org_id),
      });

      const tomorrowKey = new Date(TODAY.getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
      const glosas = orgEntries.filter((e) => e.status === "glosado");

      if (cancelled) return;
      setState({
        overview,
        series,
        today,
        byProfessional,
        planSummary,
        insights,
        people,
        patients: new Map(orgPatients.map((p) => [p.id, p])),
        pending: {
          reminders: orgAppointments.filter(
            (a) =>
              a.starts_at.startsWith(tomorrowKey) &&
              a.status === "scheduled" &&
              !a.reminder_sent_at,
          ).length,
          glosas: glosas.length,
          glosaValue: glosas.reduce((s, e) => s + e.gross_amount, 0),
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, revision]);

  const greeting = useMemo(() => {
    const h = TODAY.getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  if (!scope || !profile || !role) return null;
  const canSeeMoney = hasPermission(scope, "finance.read.all");
  const firstName = profile.full_name.split(" ")[0];

  if (!state) return <DashboardSkeleton />;

  const chartData = state.series.map((s) => ({
    label: monthLabel(s.month),
    value: s.attended,
    secondary: s.no_show,
  }));

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">
            {dateLong(TODAY.toISOString())}
          </p>
          <h1 className="mt-3">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            {state.today.length === 0
              ? "Nenhuma sessão marcada para hoje."
              : `${state.today.length} sessões hoje · ${state.today.filter((a) => a.status === "attended").length} já atendidas`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/pacientes?novo=1" className="btn btn-outline btn-sm">
            <IconUsers width={16} height={16} />
            Novo paciente
          </Link>
          <Link href="/agenda?nova=1" className="btn btn-primary btn-sm">
            <IconPlus width={16} height={16} />
            Nova sessão
          </Link>
        </div>
      </header>

      {/* -------------------------------------------------------- KPIs */}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))" }}
      >
        <StatCard
          icon={<IconCalendar width={18} height={18} />}
          tint="accent"
          label="Atendimentos no mês"
          value={String(state.overview.attendances)}
          delta={state.overview.attendances_delta}
        />
        {canSeeMoney && (
          <StatCard
            icon={<IconMoney width={18} height={18} />}
            tint="success"
            label="Recebido no mês"
            value={brl(state.overview.revenue)}
            delta={state.overview.revenue_delta}
          />
        )}
        <StatCard
          icon={<IconAlert width={18} height={18} />}
          tint="danger"
          label="Taxa de faltas"
          value={pct(state.overview.no_show_rate)}
          delta={state.overview.no_show_delta}
          inverse
        />
        <StatCard
          icon={<IconUsers width={18} height={18} />}
          tint="gold"
          label="Pacientes ativos"
          value={String(state.overview.active_patients)}
          hint={`Ocupação da agenda em ${pct(state.overview.occupancy, 0)}`}
        />
      </section>

      {/* ------------------------------------------- recados da IA */}
      <AiDigest insights={state.insights} />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ------------------------------------------------ gráfico */}
        <section className="card p-6 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2>Atendimentos e faltas</h2>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Últimos 6 meses
              </p>
            </div>
            <Link
              href="/relatorios"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Ver relatórios
            </Link>
          </div>
          <StackedBars
            data={chartData}
            primaryLabel="Atendidas"
            secondaryLabel="Faltas"
            height={210}
          />
        </section>

        {/* ------------------------------------------------- agenda */}
        <section className="card flex flex-col p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2>Agenda de hoje</h2>
            <Link
              href="/agenda"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Abrir
            </Link>
          </div>

          {state.today.length === 0 ? (
            <EmptyBlock
              icon={<IconCalendar />}
              title="Dia livre"
              body="Nenhuma sessão marcada para hoje."
            />
          ) : (
            <ul className="-mx-2 flex-1 space-y-0.5 overflow-y-auto">
              {state.today.slice(0, 8).map((a) => {
                const who = state.people.find((p) => p.id === a.professional_id);
                const patient = state.patients.get(a.patient_id);
                return (
                  <li key={a.id}>
                    <Link
                      href="/agenda"
                      className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="tabular w-11 shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                        {time(a.starts_at)}
                      </span>
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium"
                        style={{
                          background: "var(--color-accent-soft)",
                          color: "var(--color-accent-ink)",
                        }}
                        aria-hidden="true"
                      >
                        {initials(
                          patient
                            ? `${patient.first_name} ${patient.last_name ?? ""}`
                            : "?",
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm leading-tight">
                          {patient
                            ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
                            : "Paciente"}
                        </span>
                        {!isSolo && (
                          <span className="block truncate text-xs text-[var(--color-ink-subtle)]">
                            {who?.full_name ?? "—"}
                          </span>
                        )}
                      </span>
                      <AppointmentBadge status={a.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ------------------------------------------- pendências */}
        <section className="card p-6">
          <h2>Pendências</h2>
          <ul className="mt-4 space-y-3">
            <PendingRow
              tone={state.pending.reminders ? "warn" : "success"}
              label="Lembretes de amanhã"
              value={
                state.pending.reminders
                  ? `${state.pending.reminders} a enviar`
                  : "Todos enviados"
              }
              href="/agenda"
            />
            {canSeeMoney && (
              <PendingRow
                tone={state.pending.glosas ? "danger" : "success"}
                label="Glosas em aberto"
                value={
                  state.pending.glosas
                    ? `${state.pending.glosas} · ${brl(state.pending.glosaValue)}`
                    : "Nenhuma"
                }
                href="/financeiro"
              />
            )}
            <PendingRow
              tone="success"
              label="Evoluções do mês"
              value="Em dia"
              href="/prontuarios"
            />
          </ul>
        </section>

        {/* --------------------------------------- por profissional */}
        {!isSolo && state.byProfessional.length > 0 && (
          <section className="card p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2>Atendimentos por profissional</h2>
            </div>
            <RankBars
              data={state.byProfessional.slice(0, 6).map((p) => ({
                label: p.name.split(" ").slice(0, 2).join(" "),
                value: p.attended,
              }))}
            />
          </section>
        )}

        {/* -------------------------------------------- convênios */}
        {state.planSummary.length > 0 && (
          <section className="card p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2>Receita por convênio</h2>
              <Link
                href="/financeiro"
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Detalhar
              </Link>
            </div>
            <Donut
              data={state.planSummary.map((p) => ({
                label: p.name,
                value: p.value,
              }))}
              centerLabel="no mês"
              centerValue={brlCompact(
                state.planSummary.reduce((s, p) => s + p.value, 0),
              )}
              formatValue={brl}
            />
          </section>
        )}
      </div>

      {canSeeMoney && state.series.length > 1 && (
        <section className="card p-6">
          <div className="mb-5">
            <h2>Evolução do faturamento</h2>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Valores recebidos por mês
            </p>
          </div>
          <AreaChart
            data={state.series.map((s) => ({
              label: monthLabel(s.month),
              value: s.revenue,
            }))}
            formatValue={brl}
          />
        </section>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- componentes */

function StatCard({
  icon,
  label,
  value,
  delta,
  inverse,
  hint,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  inverse?: boolean;
  hint?: string;
  tint: "accent" | "success" | "danger" | "gold";
}) {
  const tints = {
    accent: ["var(--color-accent-soft)", "var(--color-accent-ink)"],
    success: ["var(--color-success-soft)", "var(--color-success)"],
    danger: ["var(--color-danger-soft)", "var(--color-danger)"],
    gold: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
  }[tint];

  const has = typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) >= 0.05;
  const good = has ? (inverse ? delta < 0 : delta > 0) : false;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="icon-chip"
          style={{ background: tints[0], color: tints[1] }}
          aria-hidden="true"
        >
          {icon}
        </span>
        {has && (
          <span
            className={`badge badge-plain ${
              good
                ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
            }`}
          >
            {delta! > 0 ? (
              <IconArrowUp width={12} height={12} />
            ) : (
              <IconArrowDown width={12} height={12} />
            )}
            {Math.abs(delta!).toFixed(1).replace(".", ",")}%
          </span>
        )}
      </div>
      <p className="overline mt-4">{label}</p>
      <p className="tabular mt-1.5 font-[family-name:var(--font-mono)] text-[1.6rem] leading-none">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">{hint}</p>
      )}
    </div>
  );
}

function AiDigest({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;

  return (
    <section className="card card-highlight overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] bg-[var(--color-gold-soft)] px-5 py-3">
        <IconSparkle width={17} height={17} style={{ color: "var(--color-gold-ink)" }} />
        <h2 className="flex-1" style={{ color: "var(--color-gold-ink)" }}>
          Recados da {ASSISTANT_NAME}
        </h2>
        <Link
          href="/assistente"
          className="text-sm hover:underline"
          style={{ color: "var(--color-gold-ink)" }}
        >
          Conversar
        </Link>
      </div>

      <ul className="divide-y divide-[var(--color-line)]">
        {insights.map((insight) => (
          <li key={insight.id} className="flex gap-3.5 px-5 py-3.5">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                background:
                  insight.tone === "attention"
                    ? "var(--color-warn)"
                    : insight.tone === "positive"
                      ? "var(--color-success)"
                      : "var(--color-info)",
              }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                {insight.body}
              </p>
            </div>
            {insight.action && (
              <Link
                href={insight.action.href}
                className="btn btn-ghost btn-sm shrink-0 self-center text-[var(--color-accent)]"
              >
                {insight.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PendingRow({
  tone,
  label,
  value,
  href,
}: {
  tone: "warn" | "danger" | "success";
  label: string;
  value: string;
  href: string;
}) {
  const tones = {
    warn: ["var(--color-warn-soft)", "var(--color-warn)"],
    danger: ["var(--color-danger-soft)", "var(--color-danger)"],
    success: ["var(--color-success-soft)", "var(--color-success)"],
  }[tone];

  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px]"
          style={{ background: tones[0], color: tones[1] }}
          aria-hidden="true"
        >
          {tone === "success" ? (
            <IconCheck width={15} height={15} />
          ) : (
            <IconAlert width={15} height={15} />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">{label}</span>
        <span className="shrink-0 text-sm text-[var(--color-ink-muted)]">
          {value}
        </span>
      </Link>
    </li>
  );
}

function EmptyBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="grid flex-1 place-content-center justify-items-center py-10 text-center">
      <span
        className="icon-chip mb-3"
        style={{
          background: "var(--color-surface-2)",
          color: "var(--color-ink-subtle)",
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-[22ch] text-sm text-[var(--color-ink-muted)]">
        {body}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-16 w-72" />
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[132px]" />
        ))}
      </div>
      <div className="skeleton h-32 w-full" />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="skeleton h-80 xl:col-span-2" />
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}

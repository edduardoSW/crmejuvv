"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { ViewToggle, type ViewMode } from "@/components/ui/ViewToggle";
import { EntryCard } from "@/components/finance/EntryCard";
import { StatementTab } from "@/components/finance/StatementTab";
import { EntryBadge } from "@/components/ui/Status";
import { Donut, RankBars } from "@/components/ui/Charts";
import { brl, brlCompact, date } from "@/lib/format";
import { hasPermission } from "@/lib/domain/types";
import type {
  EntryStatus, FinancialEntry, HealthPlan, Patient, PaymentMethod, Profile,
} from "@/lib/domain/types";
import type { PlanSummary, PayoutPreview } from "@/lib/repository/local/finance";
import { IconMoney, IconAlert, IconX } from "@/components/icons";

const TODAY = new Date(2026, 7, 17, 23, 59);
const MONTH_START = new Date(2026, 7, 1);

type Tab = "lancamentos" | "extrato" | "convenios" | "repasses";

export default function FinanceiroPage() {
  const { scope, revision, isSolo } = useApp();
  const [tab, setTab] = useState<Tab>("lancamentos");
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [summary, setSummary] = useState<PlanSummary[]>([]);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [filterStatus, setFilterStatus] = useState<EntryStatus | "">("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [payTarget, setPayTarget] = useState<FinancialEntry | null>(null);
  const [glosaTarget, setGlosaTarget] = useState<FinancialEntry | null>(null);
  const [editTarget, setEditTarget] = useState<FinancialEntry | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FinancialEntry | null>(null);
  const [payout, setPayout] = useState<PayoutPreview | null>(null);
  const [payoutPro, setPayoutPro] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("cards");

  const canAll = scope ? hasPermission(scope, "finance.read.all") : false;

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    const [list, pats, pros, hp] = await Promise.all([
      repo.finance.listEntries(scope, {
        per_page: 300,
        status: filterStatus ? [filterStatus] : undefined,
        health_plan_id: filterPlan || undefined,
      }),
      repo.patients.list(scope, { per_page: 500 }),
      repo.team.listProfessionals(scope),
      repo.settings.healthPlans(scope),
    ]);
    setEntries(
      filterPatient
        ? list.items.filter((e) => e.patient_id === filterPatient)
        : list.items,
    );
    setPatients(new Map(pats.items.map((p) => [p.id, p])));
    setProfessionals(pros);
    setPlans(hp);

    if (canAll) {
      setSummary(
        await repo.finance.summaryByPlan(scope, {
          from: MONTH_START.toISOString(),
          to: TODAY.toISOString(),
        }),
      );
    }
    setLoading(false);
  }, [scope, filterStatus, filterPlan, filterPatient, canAll]);

  useEffect(() => { load(); }, [load, revision]);

  useEffect(() => {
    if (!scope || tab !== "repasses") return;
    const target = payoutPro || professionals[0]?.id;
    if (!target) return;
    setPayoutPro(target);
    repo.finance
      .previewPayout(scope, {
        professional_id: target,
        from: MONTH_START.toISOString(),
        to: TODAY.toISOString(),
      })
      .then(setPayout)
      .catch(() => setPayout(null));
  }, [scope, tab, payoutPro, professionals, revision]);

  if (!scope) return null;

  const totals = {
    previsto: entries.filter((e) => e.status === "previsto").reduce((s, e) => s + e.gross_amount, 0),
    faturado: entries.filter((e) => e.status === "faturado").reduce((s, e) => s + e.gross_amount, 0),
    recebido: entries.filter((e) => e.status === "recebido").reduce((s, e) => s + e.gross_amount, 0),
    glosado: entries.filter((e) => e.status === "glosado").reduce((s, e) => s + e.gross_amount, 0),
  };

  async function exportCsv() {
    if (!scope) return;
    const csv = await repo.finance.exportCsv(scope, {});
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lancamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">Gestão</p>
          <h1 className="mt-3">Financeiro</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            Faturamento por convênio e atendimento particular.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv}>
          Exportar CSV
        </button>
      </header>

      <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <MoneyCard label="Previsto" value={totals.previsto} tone="info" />
        <MoneyCard label="Faturado" value={totals.faturado} tone="warn" />
        <MoneyCard label="Recebido" value={totals.recebido} tone="success" />
        <MoneyCard label="Glosado" value={totals.glosado} tone="danger" />
      </section>

      <div role="tablist" className="tabs">
        {([
          { id: "lancamentos", label: "Lançamentos" },
          { id: "extrato" as Tab, label: "Extrato" },
          ...(canAll
            ? [
                { id: "convenios" as Tab, label: "Por convênio" },
                // Repasse só existe quando há alguém para repassar.
                ...(isSolo ? [] : [{ id: "repasses" as Tab, label: "Repasses" }]),
              ]
            : []),
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--color-accent)" }} />
            )}
          </button>
        ))}
      </div>

      {tab === "lancamentos" && (
        <>
          <div className="card flex flex-wrap gap-3 p-3">
            <Select
              label="Filtrar por situação"
              size="sm"
              className="w-[180px]"
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as EntryStatus | "")}
              options={[
                { value: "", label: "Todas as situações" },
                { value: "previsto", label: "Previsto" },
                { value: "faturado", label: "Faturado" },
                { value: "recebido", label: "Recebido" },
                { value: "glosado", label: "Glosado" },
              ]}
            />
            <Select
              label="Filtrar por convênio"
              size="sm"
              className="w-[180px]"
              value={filterPlan}
              onChange={setFilterPlan}
              options={[
                { value: "", label: "Todos os convênios" },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Select
              label="Filtrar por paciente"
              size="sm"
              className="w-[210px]"
              value={filterPatient}
              onChange={setFilterPatient}
              options={[
                { value: "", label: "Todos os pacientes" },
                ...[...patients.values()]
                  .sort((a, b) => a.first_name.localeCompare(b.first_name, "pt-BR"))
                  .map((p) => ({
                    value: p.id,
                    label: `${p.first_name} ${p.last_name ?? ""}`.trim(),
                  })),
              ]}
            />
            <span className="ml-auto">
              <ViewToggle value={view} onChange={setView} />
            </span>
          </div>

          {!loading && entries.length > 0 && view === "cards" && (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {entries.slice(0, 60).map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  patient={patients.get(e.patient_id)}
                  professional={professionals.find((p) => p.id === e.professional_id)}
                  planName={plans.find((p) => p.id === e.health_plan_id)?.name ?? "Convênio"}
                  onReceive={() => setPayTarget(e)}
                  onGlosa={() => setGlosaTarget(e)}
                  onEdit={() => setEditTarget(e)}
                  onDelete={() => setRemoveTarget(e)}
                />
              ))}
            </div>
          )}

          <div
            className={`card overflow-hidden ${
              !loading && entries.length > 0 && view === "cards" ? "hidden" : ""
            }`}
          >
            {loading ? (
              <div className="space-y-px p-4">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-12 w-full" />)}
              </div>
            ) : entries.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="scroll-x">
                <table className="w-full text-sm">
                  <caption className="sr-only">Lançamentos financeiros</caption>
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-left">
                      <th scope="col" className="overline px-5 py-3">Data</th>
                      <th scope="col" className="overline px-5 py-3">Paciente</th>
                      <th scope="col" className="overline px-5 py-3">Origem</th>
                      {!isSolo && (
                        <th scope="col" className="overline px-5 py-3">Profissional</th>
                      )}
                      <th scope="col" className="overline px-5 py-3">Valor</th>
                      <th scope="col" className="overline px-5 py-3">Situação</th>
                      <th scope="col" className="overline px-5 py-3"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, 80).map((e) => {
                      const patient = patients.get(e.patient_id);
                      return (
                        <tr key={e.id} className="table-row">
                          <td className="tabular px-5 py-3 text-[var(--color-ink-muted)]">{date(e.created_at)}</td>
                          <td className="px-5 py-3">
                            {patient ? `${patient.first_name} ${patient.last_name ?? ""}`.trim() : "—"}
                          </td>
                          <td className="px-5 py-3 text-[var(--color-ink-muted)]">
                            {e.origin === "convenio"
                              ? plans.find((p) => p.id === e.health_plan_id)?.name ?? "Convênio"
                              : "Particular"}
                          </td>
                          {!isSolo && (
                            <td className="px-5 py-3 text-[var(--color-ink-muted)]">
                              {professionals.find((p) => p.id === e.professional_id)?.full_name ?? "—"}
                            </td>
                          )}
                          <td className="tabular px-5 py-3 font-[family-name:var(--font-mono)]">{brl(e.gross_amount)}</td>
                          <td className="px-5 py-3"><EntryBadge status={e.status} /></td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              {e.status !== "recebido" && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPayTarget(e)}>
                                  Receber
                                </button>
                              )}
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditTarget(e)}>
                                Editar
                              </button>
                              <button
                                type="button"
                                aria-label="Excluir lançamento"
                                className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-danger)]"
                                onClick={() => setRemoveTarget(e)}
                              >
                                <IconX width={14} height={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "extrato" && (
        <StatementTab entries={entries} patients={patients} />
      )}

      {tab === "convenios" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-6">
            <h2>Distribuição da receita</h2>
            <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Mês corrente</p>
            <Donut
              data={summary.map((s) => ({ label: s.name, value: s.total }))}
              centerLabel="no mês"
              centerValue={brlCompact(summary.reduce((s, p) => s + p.total, 0))}
              formatValue={brl}
            />
          </section>

          <section className="card p-6">
            <h2>Recebido por operadora</h2>
            <p className="mt-0.5 mb-5 text-sm text-[var(--color-ink-muted)]">Somente lançamentos liquidados</p>
            <RankBars
              data={summary.map((s) => ({ label: s.name, value: s.recebido }))}
              formatValue={brl}
            />
          </section>

          <section className="card overflow-hidden lg:col-span-2">
            <div className="scroll-x">
              <table className="w-full text-sm">
                <caption className="sr-only">Faturamento por convênio</caption>
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left">
                    <th scope="col" className="overline px-5 py-3">Operadora</th>
                    <th scope="col" className="overline px-5 py-3">Sessões</th>
                    <th scope="col" className="overline px-5 py-3">Previsto</th>
                    <th scope="col" className="overline px-5 py-3">Faturado</th>
                    <th scope="col" className="overline px-5 py-3">Recebido</th>
                    <th scope="col" className="overline px-5 py-3">Glosado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.name} className="table-row">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="tabular px-5 py-3">{s.count}</td>
                      <td className="tabular px-5 py-3">{brl(s.previsto)}</td>
                      <td className="tabular px-5 py-3">{brl(s.faturado)}</td>
                      <td className="tabular px-5 py-3 text-[var(--color-success)]">{brl(s.recebido)}</td>
                      <td className="tabular px-5 py-3 text-[var(--color-danger)]">{brl(s.glosado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "repasses" && (
        <section className="card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2>Repasse do mês</h2>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Calculado sobre lançamentos recebidos, pela regra configurada.
              </p>
            </div>
            <Select
              label="Profissional"
              size="sm"
              className="w-[210px]"
              value={payoutPro}
              onChange={setPayoutPro}
              options={professionals.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </div>

          {payout ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <MoneyCard label="Bruto recebido" value={payout.gross_total} tone="info" />
                <MoneyCard label="Repasse à profissional" value={payout.payout_total} tone="success" />
                <MoneyCard label="Retido pela clínica" value={payout.gross_total - payout.payout_total} tone="gold" />
              </div>
              <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
                {payout.entries.length} lançamentos no período.{" "}
                <strong>Regra ainda a confirmar com a cliente.</strong> Hoje o padrão
                é 50% por sessão, configurável por profissional, convênio e serviço.
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
              Sem lançamentos recebidos no período para esta profissional.
            </p>
          )}
        </section>
      )}

      <EditEntryModal
        entry={editTarget}
        plans={plans}
        onClose={() => setEditTarget(null)}
        onDone={() => { setEditTarget(null); load(); }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Excluir lançamento"
        description={`${removeTarget ? brl(removeTarget.gross_amount) : ""} sai do faturamento do mês e dos relatórios. A sessão continua na agenda.`}
        confirmText="EXCLUIR"
        confirmLabel="Excluir lançamento"
        onConfirm={async () => {
          if (!removeTarget || !scope) return;
          await repo.finance.removeEntry(scope, removeTarget.id);
          setRemoveTarget(null);
          load();
        }}
      />

      <PaymentModal entry={payTarget} onClose={() => setPayTarget(null)} onDone={() => { setPayTarget(null); load(); }} />
      <GlosaModal entry={glosaTarget} onClose={() => setGlosaTarget(null)} onDone={() => { setGlosaTarget(null); load(); }} />
    </div>
  );
}

function MoneyCard({ label, value, tone }: { label: string; value: number; tone: "info" | "warn" | "success" | "danger" | "gold" }) {
  const tones = {
    info: ["var(--color-info-soft)", "var(--color-info)"],
    warn: ["var(--color-warn-soft)", "var(--color-warn)"],
    success: ["var(--color-success-soft)", "var(--color-success)"],
    danger: ["var(--color-danger-soft)", "var(--color-danger)"],
    gold: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
  }[tone];

  return (
    <div className="card p-5">
      <span className="icon-chip" style={{ background: tones[0], color: tones[1] }} aria-hidden="true">
        <IconMoney width={18} height={18} />
      </span>
      <p className="overline mt-4">{label}</p>
      <p className="tabular mt-1.5 font-[family-name:var(--font-mono)] text-[1.35rem] leading-none">{brl(value)}</p>
    </div>
  );
}

function PaymentModal({ entry, onClose, onDone }: { entry: FinancialEntry | null; onClose: () => void; onDone: () => void }) {
  const { scope } = useApp();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [error, setError] = useState<string | null>(null);
  if (!entry || !scope) return null;

  const METHODS: { id: PaymentMethod; label: string }[] = [
    { id: "pix", label: "PIX" },
    { id: "cartao", label: "Cartão" },
    { id: "dinheiro", label: "Dinheiro" },
    { id: "convenio", label: "Convênio" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Registrar recebimento"
      description={brl(entry.gross_amount)}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              try {
                await repo.finance.registerPayment(scope, entry.id, { method });
                onDone();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Confirmar recebimento
          </button>
        </>
      }
    >
      <span className="label">Forma de pagamento</span>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`btn btn-sm ${method === m.id ? "btn-primary" : "btn-outline"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
    </Modal>
  );
}

function GlosaModal({ entry, onClose, onDone }: { entry: FinancialEntry | null; onClose: () => void; onDone: () => void }) {
  const { scope } = useApp();
  const [reason, setReason] = useState("");
  if (!entry || !scope) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Registrar glosa"
      description={`${brl(entry.gross_amount)} recusados pela operadora`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!reason.trim()}
            onClick={async () => {
              await repo.finance.registerGlosa(scope, entry.id, reason);
              onDone();
            }}
          >
            Registrar glosa
          </button>
        </>
      }
    >
      <label className="label" htmlFor="gmotivo">Motivo informado pela operadora</label>
      <textarea
        id="gmotivo"
        rows={3}
        className="field"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex.: guia sem autorização prévia"
      />
    </Modal>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="icon-chip mb-3" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-subtle)" }}>
        <IconAlert />
      </span>
      <p className="font-medium">Nenhum lançamento</p>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Sessões marcadas como atendidas geram lançamento automaticamente.
      </p>
    </div>
  );
}


function EditEntryModal({
  entry, plans, onClose, onDone,
}: {
  entry: FinancialEntry | null;
  plans: HealthPlan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { scope } = useApp();
  const [form, setForm] = useState({
    gross_amount: "", status: "previsto" as EntryStatus,
    origin: "convenio" as "convenio" | "particular", health_plan_id: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setError(null);
    setForm({
      gross_amount: String(entry.gross_amount),
      status: entry.status,
      origin: entry.origin,
      health_plan_id: entry.health_plan_id ?? plans[0]?.id ?? "",
    });
  }, [entry, plans]);

  if (!entry || !scope) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar lançamento"
      description="Corrija valor, origem ou situação."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              try {
                await repo.finance.updateEntry(scope, entry.id, {
                  gross_amount: Number(form.gross_amount.replace(",", ".")),
                  status: form.status,
                  origin: form.origin,
                  health_plan_id:
                    form.origin === "convenio" ? form.health_plan_id : null,
                });
                onDone();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="evalor">Valor (R$)</label>
          <input
            id="evalor"
            className="field"
            inputMode="decimal"
            value={form.gross_amount}
            onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
          />
        </div>

        <div>
          <span className="label">Situação</span>
          <Select
            label="Situação"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v as EntryStatus })}
            options={[
              { value: "previsto", label: "Previsto" },
              { value: "faturado", label: "Faturado" },
              { value: "recebido", label: "Recebido" },
              { value: "glosado", label: "Glosado" },
            ]}
          />
        </div>

        <div className="sm:col-span-2">
          <span className="label">Origem</span>
          <div className="flex gap-2">
            {(["convenio", "particular"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setForm({ ...form, origin: o })}
                className={`btn btn-sm flex-1 ${form.origin === o ? "btn-primary" : "btn-outline"}`}
              >
                {o === "convenio" ? "Convênio" : "Particular"}
              </button>
            ))}
          </div>
        </div>

        {form.origin === "convenio" && (
          <div className="sm:col-span-2">
            <span className="label">Convênio</span>
            <Select
              label="Convênio"
              value={form.health_plan_id}
              onChange={(v) => setForm({ ...form, health_plan_id: v })}
              options={plans.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        )}

        {error && (
          <p className="sm:col-span-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

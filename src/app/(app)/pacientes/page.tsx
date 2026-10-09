"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { PatientDrawer } from "@/components/patients/PatientDrawer";
import { PatientCard } from "@/components/patients/PatientCard";
import { ViewToggle, type ViewMode } from "@/components/ui/ViewToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { readDatabase } from "@/lib/repository/store";
import type { HealthPlan, Patient, Profile } from "@/lib/domain/types";
import { IconPlus, IconSearch, IconUsers } from "@/components/icons";

export default function PacientesPage() {
  const { scope, revision, isSolo } = useApp();
  const params = useSearchParams();

  const [items, setItems] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterPro, setFilterPro] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("active");
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(params.get("novo") === "1");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("cards");
  const [meta, setMeta] = useState<
    Map<string, { sessions: number; notes: number; next: string | null }>
  >(new Map());

  const [perPage, setPerPage] = useState(12);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    const [result, pros, hp] = await Promise.all([
      repo.patients.list(scope, {
        page,
        per_page: perPage,
        search: search || undefined,
        professional_id: filterPro || undefined,
        health_plan_id: filterPlan || undefined,
        status: filterStatus || undefined,
      }),
      repo.team.listProfessionals(scope),
      repo.settings.healthPlans(scope),
    ]);
    setItems(result.items);
    setTotal(result.total);
    setProfessionals(pros);
    setPlans(hp);

    // Contadores por card — leitura direta de metadados, sem conteúdo clínico.
    const db = readDatabase();
    const now = new Date().toISOString();
    setMeta(
      new Map(
        result.items.map((p) => {
          const appts = db.appointments.filter(
            (a) => a.org_id === scope.org_id && a.patient_id === p.id,
          );
          const next = appts
            .filter((a) => a.starts_at > now && a.status !== "cancelled")
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
          return [
            p.id,
            {
              sessions: appts.filter((a) => a.status === "attended").length,
              notes: db.patient_notes.filter(
                (n) => n.org_id === scope.org_id && n.patient_id === p.id,
              ).length,
              next: next?.starts_at ?? null,
            },
          ];
        }),
      ),
    );
    setLoading(false);
  }, [scope, page, perPage, search, filterPro, filterPlan, filterStatus]);

  useEffect(() => {
    load();
  }, [load, revision]);

  const planName = useCallback(
    (id: string | null) => plans.find((p) => p.id === id)?.name ?? "Particular",
    [plans],
  );

  const stats = useMemo(() => {
    const convenio = items.filter((p) => p.payment_type === "convenio").length;
    return {
      convenio,
      particular: items.length - convenio,
      faltosos: items.filter((p) => p.no_show_count >= 3).length,
    };
  }, [items]);

  if (!scope) return null;
  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">Atendimento</p>
          <h1 className="mt-3">Pacientes</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            {total} cadastrados · {stats.convenio} por convênio ·{" "}
            {stats.particular} particulares
            {stats.faltosos > 0 && ` · ${stats.faltosos} com faltas recorrentes`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          <IconPlus width={16} height={16} />
          Novo paciente
        </button>
      </header>

      {/* ------------------------------------------------------ filtros */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-subtle)]"
          />
          <input
            type="search"
            className="field h-9 pl-9"
            placeholder="Nome, telefone ou CPF"
            aria-label="Buscar paciente"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {!isSolo && scope.allowed_professional_ids === null && (
          <Select
            label="Filtrar por profissional"
            size="sm"
            className="w-[190px]"
            value={filterPro}
            onChange={(v) => { setFilterPro(v); setPage(1); }}
            options={[
              { value: "", label: "Todas as profissionais" },
              ...professionals.map((p) => ({ value: p.id, label: p.full_name })),
            ]}
          />
        )}

        <Select
          label="Filtrar por convênio"
          size="sm"
          className="w-[170px]"
          value={filterPlan}
          onChange={(v) => { setFilterPlan(v); setPage(1); }}
          options={[
            { value: "", label: "Todos os convênios" },
            ...plans.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        <Select
          label="Filtrar por situação"
          size="sm"
          className="w-[130px]"
          value={filterStatus}
          onChange={(v) => {
            setFilterStatus(v as typeof filterStatus);
            setPage(1);
          }}
          options={[
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos" },
            { value: "", label: "Todos" },
          ]}
        />

        <span className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </span>
      </div>

      {/* --------------------------------------------------- cards */}
      {!loading && items.length > 0 && view === "cards" && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))" }}
        >
          {items.map((patient) => {
            const m = meta.get(patient.id);
            return (
              <PatientCard
                key={patient.id}
                patient={patient}
                owner={professionals.find((p) => p.id === patient.owner_id)}
                planName={planName(patient.health_plan_id)}
                nextSession={m?.next ?? null}
                sessionCount={m?.sessions ?? 0}
                noteCount={m?.notes ?? 0}
                onOpen={() => setSelected(patient)}
              />
            );
          })}
        </div>
      )}

      {loading && view === "cards" && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))" }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-[196px]" />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- tabela */}
      <div
        className={`card overflow-hidden ${
          !loading && items.length > 0 && view === "cards" ? "hidden" : ""
        }`}
      >
        {loading ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span
              className="icon-chip mb-3"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-ink-subtle)",
              }}
            >
              <IconUsers />
            </span>
            <p className="font-medium">Nenhum paciente encontrado</p>
            <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">
              {search || filterPro || filterPlan
                ? "Nenhum resultado para os filtros aplicados."
                : "Cadastre a primeira paciente para começar."}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-4"
              onClick={() => setCreating(true)}
            >
              <IconPlus width={15} height={15} />
              Novo paciente
            </button>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="w-full text-sm">
              <caption className="sr-only">Lista de pacientes</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th scope="col" className="overline px-5 py-3">Paciente</th>
                  <th scope="col" className="overline px-5 py-3">Contato</th>
                  <th scope="col" className="overline px-5 py-3">Pagamento</th>
                  {!isSolo && (
                    <th scope="col" className="overline px-5 py-3">Responsável</th>
                  )}
                  <th scope="col" className="overline px-5 py-3">Faltas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((patient) => {
                  const name = `${patient.first_name} ${patient.last_name ?? ""}`.trim();
                  return (
                    <tr
                      key={patient.id}
                      className="table-row cursor-pointer"
                      onClick={() => setSelected(patient)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelected(patient);
                      }}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} src={patient.avatar_url} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            {patient.status === "inactive" && (
                              <p className="text-xs text-[var(--color-ink-subtle)]">
                                Inativo
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="tabular px-5 py-3 text-[var(--color-ink-muted)]">
                        {patient.phone}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="badge"
                          style={
                            patient.payment_type === "convenio"
                              ? {
                                  background: "var(--color-info-soft)",
                                  color: "var(--color-info)",
                                }
                              : {
                                  background: "var(--color-gold-soft)",
                                  color: "var(--color-gold-ink)",
                                }
                          }
                        >
                          {patient.payment_type === "convenio"
                            ? planName(patient.health_plan_id)
                            : "Particular"}
                        </span>
                      </td>
                      {!isSolo && (
                        <td className="px-5 py-3 text-[var(--color-ink-muted)]">
                          {professionals.find((p) => p.id === patient.owner_id)
                            ?.full_name ?? "—"}
                        </td>
                      )}
                      <td className="tabular px-5 py-3">
                        <span
                          className={
                            patient.no_show_count >= 3
                              ? "font-medium text-[var(--color-danger)]"
                              : "text-[var(--color-ink-muted)]"
                          }
                        >
                          {patient.no_show_count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          perPage={perPage}
          label="pacientes"
          onChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      )}

      <NewPatientModal
        open={creating}
        onClose={() => setCreating(false)}
        professionals={professionals}
        plans={plans}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />

      <PatientDrawer
        scope={scope}
        patient={selected}
        professionals={professionals}
        planName={planName}
        plans={plans}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          load();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------ modal de criação */

function NewPatientModal({
  open,
  onClose,
  professionals,
  plans,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  professionals: Profile[];
  plans: HealthPlan[];
  onCreated: () => void;
}) {
  const { scope } = useApp();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    cpf: "",
    date_of_birth: "",
    owner_id: "",
    payment_type: "convenio" as "convenio" | "particular",
    health_plan_id: "",
    health_plan_number: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        owner_id: f.owner_id || professionals[0]?.id || "",
        health_plan_id: f.health_plan_id || plans[0]?.id || "",
      }));
      setError(null);
    }
  }, [open, professionals, plans]);

  async function submit() {
    if (!scope) return;
    setBusy(true);
    setError(null);
    try {
      await repo.patients.create(scope, {
        first_name: form.first_name,
        last_name: form.last_name || null,
        phone: form.phone,
        cpf: form.cpf || null,
        date_of_birth: form.date_of_birth || null,
        owner_id: form.owner_id,
        payment_type: form.payment_type,
        health_plan_id:
          form.payment_type === "convenio" ? form.health_plan_id : null,
        health_plan_number:
          form.payment_type === "convenio" ? form.health_plan_number : null,
      });
      setForm({
        first_name: "", last_name: "", phone: "", cpf: "", date_of_birth: "",
        owner_id: professionals[0]?.id ?? "", payment_type: "convenio",
        health_plan_id: plans[0]?.id ?? "", health_plan_number: "",
      });
      onCreated();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const valid = form.first_name.trim() && form.phone.trim() && form.owner_id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo paciente"
      description="Dados mínimos para começar a agendar."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={!valid || busy}
          >
            {busy ? "Salvando…" : "Cadastrar paciente"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pnome">Nome *</label>
          <input
            id="pnome"
            className="field"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="psobrenome">Sobrenome</label>
          <input
            id="psobrenome"
            className="field"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="ptel">Telefone *</label>
          <input
            id="ptel"
            className="field"
            placeholder="(21) 90000-0000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="pcpf">CPF</label>
          <input
            id="pcpf"
            className="field"
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="pnasc">Nascimento</label>
          <input
            id="pnasc"
            type="date"
            className="field"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
        </div>
        {professionals.length > 1 && (
          <div>
            <label className="label" htmlFor="presp">Responsável *</label>
            <Select
              label="Responsável"
              value={form.owner_id}
              onChange={(v) => setForm({ ...form, owner_id: v })}
              options={professionals.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <span className="label">Forma de pagamento</span>
          <div className="flex gap-2">
            {(["convenio", "particular"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, payment_type: t })}
                className={`btn btn-sm flex-1 ${
                  form.payment_type === t ? "btn-primary" : "btn-outline"
                }`}
              >
                {t === "convenio" ? "Convênio" : "Particular"}
              </button>
            ))}
          </div>
        </div>

        {form.payment_type === "convenio" && (
          <>
            <div>
              <label className="label" htmlFor="pconv">Convênio</label>
              <Select
                label="Convênio"
                value={form.health_plan_id}
                onChange={(v) => setForm({ ...form, health_plan_id: v })}
                options={plans.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="pcart">Carteirinha</label>
              <input
                id="pcart"
                className="field"
                value={form.health_plan_number}
                onChange={(e) =>
                  setForm({ ...form, health_plan_number: e.target.value })
                }
              />
            </div>
          </>
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

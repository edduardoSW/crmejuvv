"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor, isRepoError } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { ViewToggle, type ViewMode } from "@/components/ui/ViewToggle";
import { RecordCard } from "@/components/records/RecordCard";
import { RecordViewer } from "@/components/records/RecordViewer";
import { date, initials, time } from "@/lib/format";
import type {
  ClinicalRecordMeta, Patient, Profile, Template,
} from "@/lib/domain/types";
import {
  IconCheck, IconFilter, IconLock, IconPlus, IconRecord, IconSearch, IconX,
} from "@/components/icons";

type Signature = "" | "assinados" | "rascunhos";
type Owner = "" | "meus";

interface Filters {
  patient: string;
  professional: string;
  signature: Signature;
  owner: Owner;
  from: string;
  to: string;
}

const EMPTY: Filters = {
  patient: "",
  professional: "",
  signature: "",
  owner: "",
  from: "",
  to: "",
};

export default function ProntuariosPage() {
  const { scope, revision, isSolo } = useApp();
  const [records, setRecords] = useState<ClinicalRecordMeta[]>([]);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filterOpen, setFilterOpen] = useState(false);
  const [open, setOpen] = useState<ClinicalRecordMeta | null>(null);
  const [view, setView] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    const [recs, pats, pros, tpl] = await Promise.all([
      repo.records.listMeta(scope, { per_page: 500 }),
      repo.patients.list(scope, { per_page: 500 }),
      repo.team.listProfessionals(scope),
      repo.settings.templates(scope, "evolution"),
    ]);
    setRecords(recs.items);
    setPatients(new Map(pats.items.map((p) => [p.id, p])));
    setProfessionals(pros);
    setTemplates(tpl);
    setLoading(false);
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  const nameOf = useCallback(
    (id: string) => {
      const p = patients.get(id);
      return p ? `${p.first_name} ${p.last_name ?? ""}`.trim() : "Paciente";
    },
    [patients],
  );

  const activeCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const visible = useMemo(() => {
    if (!scope) return [];
    const q = search.trim().toLowerCase();

    return records.filter((r) => {
      if (filters.owner === "meus" && r.professional_id !== scope.profile_id) return false;
      if (filters.patient && r.patient_id !== filters.patient) return false;
      if (filters.professional && r.professional_id !== filters.professional) return false;
      if (filters.signature === "assinados" && !r.signed_at) return false;
      if (filters.signature === "rascunhos" && r.signed_at) return false;
      if (filters.from && r.created_at < `${filters.from}T00:00:00`) return false;
      if (filters.to && r.created_at > `${filters.to}T23:59:59`) return false;

      if (q) {
        const patient = nameOf(r.patient_id).toLowerCase();
        const author = (
          professionals.find((p) => p.id === r.professional_id)?.full_name ?? ""
        ).toLowerCase();
        if (!patient.includes(q) && !author.includes(q)) return false;
      }
      return true;
    });
  }, [records, filters, search, scope, nameOf, professionals]);

  if (!scope) return null;
  const mine = records.filter((r) => r.professional_id === scope.profile_id).length;

  return (
    <div className="space-y-5">
      <header>
        <p className="overline overline-gold">Atendimento</p>
        <h1 className="mt-3">Prontuários</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
          {records.length} evoluções ·{" "}
          {records.filter((r) => !r.signed_at).length} sem assinatura
        </p>
      </header>

      {/* ------------------------------------------- busca e filtros */}
      <div className="card flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-subtle)]"
          />
          <input
            type="search"
            className="field h-9 pl-9"
            placeholder="Buscar por paciente"
            aria-label="Buscar evolução"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label="Filtros"
          className={`btn btn-sm relative ${
            activeCount ? "btn-primary" : "btn-outline"
          }`}
        >
          <IconFilter width={15} height={15} />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <span
              className="tabular grid h-4 min-w-4 place-items-center rounded-full px-1 font-[family-name:var(--font-mono)] text-[10px] leading-none"
              style={{ background: "rgba(255,255,255,.28)" }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-[var(--color-ink-muted)]"
            onClick={() => setFilters(EMPTY)}
          >
            <IconX width={14} height={14} />
            Limpar
          </button>
        )}

        <span className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </span>
      </div>

      {/* --------------------------------------------- chips ativos */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.owner === "meus" && (
            <Chip label="Somente minhas" onClear={() => setFilters({ ...filters, owner: "" })} />
          )}
          {filters.patient && (
            <Chip
              label={nameOf(filters.patient)}
              onClear={() => setFilters({ ...filters, patient: "" })}
            />
          )}
          {filters.professional && (
            <Chip
              label={professionals.find((p) => p.id === filters.professional)?.full_name ?? "Profissional"}
              onClear={() => setFilters({ ...filters, professional: "" })}
            />
          )}
          {filters.signature && (
            <Chip
              label={filters.signature === "assinados" ? "Assinadas" : "Rascunhos"}
              onClear={() => setFilters({ ...filters, signature: "" })}
            />
          )}
          {filters.from && (
            <Chip label={`A partir de ${date(`${filters.from}T12:00:00`)}`} onClear={() => setFilters({ ...filters, from: "" })} />
          )}
          {filters.to && (
            <Chip label={`Até ${date(`${filters.to}T12:00:00`)}`} onClear={() => setFilters({ ...filters, to: "" })} />
          )}
        </div>
      )}

      {/* ------------------------------------------------------ cards */}
      {!loading && visible.length > 0 && view === "cards" && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))" }}
        >
          {visible.slice(0, 60).map((r) => (
            <RecordCard
              key={r.id}
              record={r}
              patient={patients.get(r.patient_id)}
              author={professionals.find((p) => p.id === r.professional_id)}
              isMine={r.professional_id === scope.profile_id}
              onOpen={() => setOpen(r)}
            />
          ))}
        </div>
      )}

      {loading && view === "cards" && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))" }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-[214px]" />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ lista */}
      <div
        className={`card overflow-hidden ${
          !loading && visible.length > 0 && view === "cards" ? "hidden" : ""
        }`}
      >
        {loading ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-14 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="icon-chip mb-3" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-subtle)" }}>
              <IconRecord />
            </span>
            <p className="font-medium">
              {search || activeCount ? "Nenhum resultado" : "Nenhuma evolução"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">
              {search || activeCount
                ? "Nenhuma evolução corresponde à busca ou aos filtros aplicados."
                : "Marque uma sessão como atendida na agenda para registrar a evolução."}
            </p>
            {(search || activeCount > 0) && (
              <button
                type="button"
                className="btn btn-outline btn-sm mt-4"
                onClick={() => { setSearch(""); setFilters(EMPTY); }}
              >
                Limpar busca e filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-2.5">
              <p className="overline">
                {visible.length} de {records.length}
              </p>
            </div>
            <ul className="divide-y divide-[var(--color-line)]">
              {visible.slice(0, 120).map((r) => {
                const patient = patients.get(r.patient_id);
                const author = professionals.find((p) => p.id === r.professional_id);
                const isMine = r.professional_id === scope.profile_id;
                const name = nameOf(r.patient_id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(r)}
                      className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      <Avatar name={name} src={patient?.avatar_url} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block truncate text-xs text-[var(--color-ink-subtle)]">
                          {author?.full_name ?? "—"}
                        </span>
                      </span>
                      <span className="tabular hidden shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)] sm:block">
                        {date(r.created_at)} {time(r.created_at)}
                      </span>
                      {r.signed_at ? (
                        <span className="badge" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
                          Assinada
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--color-warn-soft)", color: "var(--color-warn)" }}>
                          Rascunho
                        </span>
                      )}
                      {!isMine && (
                        <IconLock width={15} height={15} className="shrink-0 text-[var(--color-ink-subtle)]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* ----------------------------------------- modal de filtros */}
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
        professionals={professionals}
        patients={[...patients.values()].sort((a, b) =>
          a.first_name.localeCompare(b.first_name, "pt-BR"),
        )}
        canFilterProfessional={!isSolo && scope.allowed_professional_ids === null}
      />

      <RecordModal
        record={open}
        patients={patients}
        professionals={professionals}
        templates={templates}
        onClose={() => setOpen(null)}
        onChanged={load}
      />
    </div>
  );
}

/* ---------------------------------------------------------- filtros */

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      className="badge badge-plain gap-1.5"
      style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)" }}
    >
      {label}
      <button type="button" onClick={onClear} aria-label={`Remover filtro ${label}`}>
        <IconX width={11} height={11} />
      </button>
    </span>
  );
}

function FilterModal({
  open, onClose, filters, onApply, professionals, patients, canFilterProfessional,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (f: Filters) => void;
  professionals: Profile[];
  patients: Patient[];
  canFilterProfessional: boolean;
}) {
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtrar evoluções"
      description="Combine os filtros para encontrar um registro específico."
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft(EMPTY)}
          >
            Limpar tudo
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onApply(draft)}>
            Aplicar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {canFilterProfessional && (
        <div>
          <span className="label">Autoria</span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "" as Owner, label: "Todas" },
              { id: "meus" as Owner, label: "Somente minhas" },
            ]).map((o) => (
              <button
                key={o.id || "todas"}
                type="button"
                onClick={() => setDraft({ ...draft, owner: o.id })}
                className={`btn btn-sm ${draft.owner === o.id ? "btn-primary" : "btn-outline"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        )}

        <div>
          <span className="label">Paciente</span>
          <Select
            label="Paciente"
            value={draft.patient}
            onChange={(v) => setDraft({ ...draft, patient: v })}
            options={[
              { value: "", label: "Todos os pacientes" },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.first_name} ${p.last_name ?? ""}`.trim(),
              })),
            ]}
          />
        </div>

        {canFilterProfessional && (
          <div>
            <span className="label">Profissional</span>
            <Select
              label="Profissional"
              value={draft.professional}
              onChange={(v) => setDraft({ ...draft, professional: v })}
              options={[
                { value: "", label: "Todas as profissionais" },
                ...professionals.map((p) => ({ value: p.id, label: p.full_name })),
              ]}
            />
          </div>
        )}

        <div>
          <span className="label">Situação</span>
          <Select
            label="Situação"
            value={draft.signature}
            onChange={(v) => setDraft({ ...draft, signature: v as Signature })}
            options={[
              { value: "", label: "Assinadas e rascunhos" },
              { value: "assinados", label: "Somente assinadas" },
              { value: "rascunhos", label: "Somente rascunhos" },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fde">A partir de</label>
            <input
              id="fde"
              type="date"
              className="field"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="fate">Até</label>
            <input
              id="fate"
              type="date"
              className="field"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- evolução */

function RecordModal({
  record, patients, professionals, templates, onClose, onChanged,
}: {
  record: ClinicalRecordMeta | null;
  patients: Map<string, Patient>;
  professionals: Profile[];
  templates: Template[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { scope } = useApp();
  if (!record || !scope) return null;

  const patient = patients.get(record.patient_id);
  const author = professionals.find((p) => p.id === record.professional_id);
  const name = patient
    ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
    : "Paciente";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={name}
      description={`Evolução de ${date(record.created_at)} · ${author?.full_name ?? "—"}`}
    >
      <RecordViewer
        scope={scope}
        record={record}
        author={author}
        professionals={professionals}
        templates={templates}
        onChanged={onChanged}
        onClose={onClose}
      />
    </Modal>
  );
}

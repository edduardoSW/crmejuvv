"use client";

import { Select } from "@/components/ui/Select";

/**
 * Ficha do paciente — modal próprio com abas.
 * A aba Prontuário respeita a regra de sigilo: quem não é a responsável vê
 * metadados e precisa de acesso justificado (docs/00-descoberta.md §6).
 */

import { useEffect, useRef, useState } from "react";
import { Drawer, Modal } from "@/components/ui/Modal";
import { repo } from "@/lib/repository";
import { messageFor, isRepoError } from "@/lib/repository";
import { Avatar, resizeImage } from "@/components/ui/Avatar";
import { NotesTab } from "@/components/patients/NotesTab";
import { DocumentsTab } from "@/components/patients/DocumentsTab";
import { PatientActions } from "@/components/patients/PatientActions";
import { RecordViewer } from "@/components/records/RecordViewer";
import { AppointmentBadge, EntryBadge } from "@/components/ui/Status";
import { brl, date, dateLong, initials, time } from "@/lib/format";
import { hasPermission } from "@/lib/domain/types";
import type {
  Appointment,
  HealthPlan,
  ClinicalRecordMeta,
  FinancialEntry,
  Patient,
  Profile,
  Scope,
} from "@/lib/domain/types";
import { IconLock, IconRecord, IconSparkle } from "@/components/icons";

type Tab =
  | "resumo" | "anotacoes" | "sessoes" | "prontuario" | "documentos" | "financeiro";

const TABS: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "anotacoes", label: "Anotações" },
  { id: "sessoes", label: "Sessões" },
  { id: "prontuario", label: "Prontuário" },
  { id: "documentos", label: "Documentos" },
  { id: "financeiro", label: "Financeiro" },
];

export function PatientDrawer({
  scope,
  patient,
  professionals,
  planName,
  plans,
  onClose,
  onChanged,
}: {
  scope: Scope;
  patient: Patient | null;
  professionals: Profile[];
  planName: (id: string | null) => string;
  plans: HealthPlan[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("resumo");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<ClinicalRecordMeta[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [transfer, setTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) return;
    setTab("resumo");
    (async () => {
      const [appts, recs, fin] = await Promise.all([
        repo.appointments.list(scope, {
          from: new Date(2020, 0, 1).toISOString(),
          to: new Date(2030, 0, 1).toISOString(),
          patient_id: patient.id,
        }),
        repo.records.listMeta(scope, { patient_id: patient.id, per_page: 200 }),
        repo.finance.listEntries(scope, { per_page: 200 }),
      ]);
      setAppointments(appts.reverse());
      setRecords(recs.items);
      setEntries(fin.items.filter((e) => e.patient_id === patient.id));
    })();
  }, [patient, scope]);

  if (!patient) return null;

  const fullName = `${patient.first_name} ${patient.last_name ?? ""}`.trim();
  const owner = professionals.find((p) => p.id === patient.owner_id);
  const attended = appointments.filter((a) => a.status === "attended").length;
  const totalPaid = entries
    .filter((e) => e.status === "recebido")
    .reduce((s, e) => s + e.gross_amount, 0);

  async function doTransfer() {
    if (!patient) return;
    try {
      await repo.patients.transfer(scope, patient.id, transferTo, transferReason);
      setTransfer(false);
      setTransferReason("");
      onChanged();
    } catch (e) {
      setError(messageFor(e));
    }
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={fullName}
        description={
          professionals.length > 1
            ? `${patient.payment_type === "convenio" ? planName(patient.health_plan_id) : "Particular"} · ${owner?.full_name ?? "Sem responsável"}`
            : patient.payment_type === "convenio"
              ? planName(patient.health_plan_id)
              : "Particular"
        }
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <PhotoPicker
            scope={scope}
            patient={patient}
            name={fullName}
            onChanged={onChanged}
          />
          <div className="grid w-full flex-1 grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
            <MiniStat label="Sessões" value={String(attended)} />
            <MiniStat label="Faltas" value={String(patient.no_show_count)} />
            <MiniStat label="Pago" value={brl(totalPaid)} />
            <MiniStat
              label="Situação"
              value={patient.status === "active" ? "Ativo" : "Inativo"}
            />
          </div>
        </div>

        <div role="tablist" className="tabs mt-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {tab === "resumo" && (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Telefone" value={patient.phone} />
              <Field label="CPF" value={patient.cpf ?? "—"} />
              <Field
                label="Nascimento"
                value={
                  patient.date_of_birth
                    ? dateLong(`${patient.date_of_birth}T12:00:00`)
                    : "—"
                }
              />
              <Field label="E-mail" value={patient.email ?? "—"} />
              <Field
                label="Pagamento"
                value={
                  patient.payment_type === "convenio"
                    ? `${planName(patient.health_plan_id)}${patient.health_plan_number ? ` · carteirinha ${patient.health_plan_number}` : ""}`
                    : "Particular"
                }
              />
              {professionals.length > 1 && (
                <Field label="Responsável" value={owner?.full_name ?? "—"} />
              )}
              <div className="space-y-3 border-t border-[var(--color-line)] pt-4 sm:col-span-2">
                <p className="overline">Ações</p>
                {professionals.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setTransferTo(professionals[0]?.id ?? "");
                        setTransfer(true);
                      }}
                    >
                      Transferir responsabilidade
                    </button>
                  </div>
                )}
                <PatientActions
                  scope={scope}
                  patient={patient}
                  professionals={professionals}
                  plans={plans}
                  onChanged={onChanged}
                  onDeleted={onClose}
                />
              </div>
            </dl>
          )}

          {tab === "anotacoes" && (
            <NotesTab
              scope={scope}
              patientId={patient.id}
              professionals={professionals}
            />
          )}

          {tab === "sessoes" && (
            <ul className="space-y-1">
              {appointments.length === 0 && <Empty text="Nenhuma sessão registrada." />}
              {appointments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-[var(--color-surface-2)]"
                >
                  <span className="tabular w-24 shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {date(a.starts_at)} {time(a.starts_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {professionals.find((p) => p.id === a.professional_id)
                      ?.full_name ?? "—"}
                  </span>
                  <AppointmentBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}

          {tab === "prontuario" && (
            <RecordsTab
              scope={scope}
              records={records}
              professionals={professionals}
            />
          )}

          {tab === "documentos" && (
            <DocumentsTab
              scope={scope}
              patientId={patient.id}
              professionals={professionals}
            />
          )}

          {tab === "financeiro" && (
            <ul className="space-y-1">
              {entries.length === 0 && <Empty text="Nenhum lançamento." />}
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-[var(--color-surface-2)]"
                >
                  <span className="tabular w-16 shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {date(e.created_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {e.origin === "convenio"
                      ? planName(e.health_plan_id)
                      : "Particular"}
                  </span>
                  <span className="tabular shrink-0 font-[family-name:var(--font-mono)] text-sm">
                    {brl(e.gross_amount)}
                  </span>
                  <EntryBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Drawer>

      <Modal
        open={transfer}
        onClose={() => setTransfer(false)}
        title="Transferir responsabilidade"
        description="O histórico permanece com o paciente. A transferência fica registrada na auditoria."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setTransfer(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={doTransfer}
              disabled={!transferTo || transferReason.trim().length < 3}
            >
              Transferir
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="para">Nova responsável</label>
            <Select
              label="Nova responsável"
              value={transferTo}
              onChange={setTransferTo}
              options={professionals
                .filter((p) => p.id !== patient.owner_id)
                .map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="motivo">Motivo</label>
            <textarea
              id="motivo"
              rows={3}
              className="field"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Ex.: realocação de agenda a pedido da paciente"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- foto */

function PhotoPicker({
  scope,
  patient,
  name,
  onChanged,
}: {
  scope: Scope;
  patient: Patient;
  name: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      // Reduz antes de guardar: foto de celular sozinha estoura o localStorage.
      const data = await resizeImage(file, 256);
      await repo.patients.setAvatar(scope, patient.id, data);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group relative shrink-0">
      <Avatar name={name} src={patient.avatar_url} size="lg" />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Foto do paciente"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={patient.avatar_url ? "Trocar foto" : "Adicionar foto"}
        className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-surface)] text-xs text-white transition-transform hover:scale-110"
        style={{ background: "var(--color-accent)" }}
      >
        {busy ? "…" : "＋"}
      </button>
      {patient.avatar_url && (
        <button
          type="button"
          onClick={async () => {
            await repo.patients.setAvatar(scope, patient.id, null);
            onChanged();
          }}
          title="Remover foto"
          className="absolute -left-1 -top-1 hidden h-6 w-6 place-items-center rounded-full border-2 border-[var(--color-surface)] text-[10px] group-hover:grid"
          style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- prontuário */

function RecordsTab({
  scope,
  records,
  professionals,
}: {
  scope: Scope;
  records: ClinicalRecordMeta[];
  professionals: Profile[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = records.find((r) => r.id === openId) ?? null;

  if (!records.length) return <Empty text="Nenhuma evolução registrada." />;

  return (
    <>
      <ul className="space-y-1">
        {records.map((r) => {
          const author = professionals.find((p) => p.id === r.professional_id);
          const mine = r.professional_id === scope.profile_id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <span className="tabular w-16 shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                  {date(r.created_at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {professionals.length > 1
                      ? (author?.full_name ?? "—")
                      : "Evolução da sessão"}
                  </span>
                  <span className="block text-xs text-[var(--color-ink-subtle)]">
                    {r.signed_at ? "Assinada" : "Rascunho"}
                  </span>
                </span>
                {!mine && (
                  <IconLock
                    width={14}
                    height={14}
                    className="shrink-0 text-[var(--color-ink-subtle)]"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Modal
        open={open !== null}
        onClose={() => setOpenId(null)}
        size="lg"
        title="Evolução da sessão"
        description={open ? date(open.created_at) : undefined}
      >
        {open && (
          <RecordViewer
            scope={scope}
            record={open}
            author={professionals.find((p) => p.id === open.professional_id)}
            professionals={professionals}
            onChanged={() => {}}
            onClose={() => setOpenId(null)}
          />
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- apoio */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[var(--color-surface-2)] px-3 py-2.5">
      <p className="overline leading-none">{label}</p>
      <p className="tabular mt-1.5 font-[family-name:var(--font-mono)] text-sm leading-none">
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="overline">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <IconRecord
        width={22}
        height={22}
        className="mb-2 text-[var(--color-ink-subtle)]"
      />
      <p className="text-sm text-[var(--color-ink-muted)]">{text}</p>
    </div>
  );
}

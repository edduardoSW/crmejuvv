"use client";

/**
 * Painel de administração: contas, papéis, permissões e auditoria.
 *
 * Vive dentro de Configurações — é ajuste de administração, não módulo de
 * atendimento, e por isso saiu da navegação principal.
 */

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { initials, date, time } from "@/lib/format";
import { ROLE_LABELS, ROLE_PERMISSIONS, type Role } from "@/lib/domain/types";
import type { MemberView } from "@/lib/repository/local/team";
import type { AuditView } from "@/lib/repository/local/audit";
import { IconPlus, IconTeam, IconLock, IconCheck } from "@/components/icons";

type Tab = "membros" | "permissoes" | "auditoria" | "sigilo";

const PERMISSION_LABELS: Record<string, string> = {
  "patient.manage": "Gerenciar cadastro de pacientes",
  "record.read.own": "Ler evoluções dos próprios pacientes",
  "record.share": "Compartilhar as próprias evoluções",
  "record.metadata.read.any": "Ver metadados de sessões de terceiros",
  "appointment.manage.any": "Gerenciar a agenda de todas",
  "appointment.manage.own": "Gerenciar a própria agenda",
  "finance.read.all": "Ver todo o financeiro",
  "finance.entry.manage": "Lançar e receber pagamentos",
  "payout.read.own": "Ver o próprio repasse",
  "report.read.all": "Ver relatórios consolidados",
  "team.manage": "Gerenciar a equipe",
  "audit.read": "Consultar a auditoria",
  "settings.manage": "Alterar configurações",
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);
const ROLES: Role[] = ["owner", "psychologist", "reception"];

export function TeamSettings() {
  const { scope, revision } = useApp();
  const [tab, setTab] = useState<Tab>("membros");
  const [members, setMembers] = useState<MemberView[]>([]);
  const [logs, setLogs] = useState<AuditView[]>([]);
  const [shares, setShares] = useState<
    (import("@/lib/domain/types").RecordShare & {
      by_name: string; with_name: string; patient_name: string;
    })[]
  >([]);
  const [inviting, setInviting] = useState(false);
  const [deactivating, setDeactivating] = useState<MemberView | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    const list = await repo.team.listMembers(scope);
    setMembers(list);
    try {
      const [audit, shared] = await Promise.all([
        repo.audit.list(scope, { per_page: 60 }),
        repo.audit.listShares(scope, { per_page: 40 }),
      ]);
      setLogs(audit.items);
      setShares(shared.items);
    } catch {
      setLogs([]); setShares([]);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  if (!scope) return null;

  const active = members.filter((m) => m.status === "active");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {active.length} contas ativas ·{" "}
          {active.filter((m) => m.role === "psychologist").length} psicólogas ·{" "}
          {members.length - active.length} desligadas
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviting(true)}>
          <IconPlus width={16} height={16} />
          Adicionar pessoa
        </button>
      </div>

      <div role="tablist" className="tabs">
        {([
          { id: "membros", label: "Contas" },
          { id: "permissoes", label: "Permissões" },
          { id: "auditoria", label: "Auditoria" },
          { id: "sigilo", label: "Compartilhamentos" },
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

      {tab === "membros" && (
        <div className="card overflow-hidden">
          <div className="scroll-x">
            <table className="w-full text-sm">
              <caption className="sr-only">Contas da organização</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th scope="col" className="overline px-5 py-3">Pessoa</th>
                  <th scope="col" className="overline px-5 py-3">CRP</th>
                  <th scope="col" className="overline px-5 py-3">Papel</th>
                  <th scope="col" className="overline px-5 py-3">Pacientes</th>
                  <th scope="col" className="overline px-5 py-3">Situação</th>
                  <th scope="col" className="overline px-5 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-medium"
                          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)" }}
                          aria-hidden="true"
                        >
                          {initials(m.profile.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.profile.full_name}</p>
                          <p className="truncate text-xs text-[var(--color-ink-subtle)]">{m.profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular px-5 py-3 text-[var(--color-ink-muted)]">{m.profile.crp ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Select
                        label={`Papel de ${m.profile.full_name}`}
                        size="sm"
                        className="w-[170px]"
                        value={m.role}
                        disabled={m.status !== "active"}
                        onChange={async (v) => {
                          await repo.team.updateRole(scope, m.id, v as Role);
                          load();
                        }}
                        options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                      />
                    </td>
                    <td className="tabular px-5 py-3">{m.patient_count}</td>
                    <td className="px-5 py-3">
                      <span
                        className="badge"
                        style={
                          m.status === "active"
                            ? { background: "var(--color-success-soft)", color: "var(--color-success)" }
                            : { background: "var(--color-surface-2)", color: "var(--color-ink-subtle)" }
                        }
                      >
                        {m.status === "active" ? "Ativa" : "Desligada"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {m.status === "active" && m.role !== "owner" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-[var(--color-danger)]"
                          onClick={() => setDeactivating(m)}
                        >
                          Desligar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "permissoes" && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <h2>Matriz de permissões</h2>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Não existe permissão de ler evolução de terceiros, nem para a
              dona. Cada profissional vê as próprias e só enxerga outra se
              houver compartilhamento.
            </p>
          </div>
          <div className="scroll-x">
            <table className="w-full text-sm">
              <caption className="sr-only">Permissões por papel</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th scope="col" className="overline px-5 py-3">Permissão</th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="overline px-5 py-3 text-center">
                      {ROLE_LABELS[r].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((perm) => (
                  <tr key={perm} className="table-row">
                    <td className="px-5 py-2.5">
                      {PERMISSION_LABELS[perm]}

                    </td>
                    {ROLES.map((r) => {
                      const has = (ROLE_PERMISSIONS[r] as string[]).includes(perm);
                      return (
                        <td key={r} className="px-5 py-2.5 text-center">
                          {has ? (
                            <IconCheck width={16} height={16} className="mx-auto text-[var(--color-success)]" />
                          ) : (
                            <span className="text-[var(--color-ink-subtle)]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "auditoria" && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <h2>Trilha de auditoria</h2>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Registro de acesso e alteração em dado sensível.
            </p>
          </div>
          {logs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--color-ink-muted)]">
              Nenhum evento registrado ainda. Abra uma evolução para ver a trilha
              sendo alimentada.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <span className="tabular font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {date(log.created_at)} {time(log.created_at)}
                  </span>
                  <span className="font-medium">{log.actor_name}</span>
                  <span className="text-[var(--color-ink-muted)]">{log.action}</span>
                  {log.reason && (
                    <span className="w-full text-xs text-[var(--color-ink-subtle)]">
                      Motivo: {log.reason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "sigilo" && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <h2>Compartilhamentos de prontuário</h2>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Cada profissional vê apenas as próprias evoluções. Quando alguém
              compartilha uma com outra pessoa, o registro aparece aqui.
            </p>
          </div>
          {shares.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--color-ink-muted)]">
              Nenhum compartilhamento até agora.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {shares.map((sh) => (
                <li key={sh.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="tabular font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                      {date(sh.created_at)} {time(sh.created_at)}
                    </span>
                    <span className="text-sm font-medium">{sh.by_name}</span>
                    <span className="text-sm text-[var(--color-ink-muted)]">
                      compartilhou a evolução de {sh.patient_name} com{" "}
                      {sh.with_name}
                    </span>
                  </div>
                  {sh.note && <p className="mt-1 text-sm">&quot;{sh.note}&quot;</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <InviteModal open={inviting} onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); }} />
      <DeactivateModal
        member={deactivating}
        members={members.filter((m) => m.status === "active")}
        onClose={() => setDeactivating(null)}
        onDone={() => { setDeactivating(null); load(); }}
      />
    </div>
  );
}

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { scope } = useApp();
  const [form, setForm] = useState({ full_name: "", email: "", crp: "", role: "psychologist" as Role });
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar pessoa à equipe"
      description="Cria a conta e o vínculo com esta organização."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!form.full_name.trim() || !form.email.trim()}
            onClick={async () => {
              if (!scope) return;
              try {
                await repo.team.invite(scope, {
                  full_name: form.full_name, email: form.email,
                  role: form.role, crp: form.crp || null,
                });
                setForm({ full_name: "", email: "", crp: "", role: "psychologist" });
                onDone();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Adicionar
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="mnome">Nome completo</label>
          <input id="mnome" className="field" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="memail">E-mail</label>
          <input id="memail" type="email" className="field" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="mcrp">CRP</label>
          <input id="mcrp" className="field" value={form.crp}
            onChange={(e) => setForm({ ...form, crp: e.target.value })} placeholder="05/12345" />
        </div>
        <div className="sm:col-span-2">
          <span className="label">Papel</span>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                className={`btn btn-sm ${form.role === r ? "btn-primary" : "btn-outline"}`}>
                {ROLE_LABELS[r].split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="sm:col-span-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function DeactivateModal({
  member, members, onClose, onDone,
}: {
  member: MemberView | null;
  members: MemberView[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { scope } = useApp();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setTo(members.find((m) => m.profile_id !== member.profile_id)?.profile_id ?? "");
      setReason("");
      setError(null);
    }
  }, [member, members]);

  if (!member) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Desligar ${member.profile.full_name}`}
      description="Nada é apagado. Os pacientes passam para outra profissional e a transferência fica registrada."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!to || reason.trim().length < 3}
            onClick={async () => {
              if (!scope) return;
              try {
                await repo.team.deactivate(scope, member.id, {
                  transfer_patients_to: to, reason,
                });
                onDone();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Desligar e transferir
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-[14px] bg-[var(--color-warn-soft)] p-3.5">
          <IconTeam width={18} height={18} style={{ color: "var(--color-warn)" }} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            <strong>{member.patient_count} pacientes</strong> estão sob
            responsabilidade dela e precisam de uma nova responsável.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="dpara">Quem assume os pacientes</label>
          <Select
            label="Quem assume os pacientes"
            value={to}
            onChange={setTo}
            options={members
              .filter((m) => m.profile_id !== member.profile_id && m.role !== "reception")
              .map((m) => ({ value: m.profile_id, label: m.profile.full_name }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="dmotivo">Motivo</label>
          <textarea id="dmotivo" rows={2} className="field" value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder="Ex.: encerramento de contrato" />
        </div>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}

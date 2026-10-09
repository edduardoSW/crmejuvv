"use client";

/**
 * Minhas tarefas — duas visões sobre o mesmo campo `bucket`:
 *  - Quadro (Kanban): uma coluna por bucket, com arrastar e soltar;
 *  - Lista: seções recolhíveis com colunas, no formato de pauta.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { date } from "@/lib/format";
import {
  TASK_BUCKET_LABELS,
  TASK_BUCKET_ORDER,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Patient,
  type Profile,
  type Task,
  type TaskBucket,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain/types";
import {
  IconAlert, IconCalendar, IconCheck, IconDashboard, IconPlus, IconRecord,
  IconSearch, IconX,
} from "@/components/icons";

const BUCKET_TONE: Record<TaskBucket, string> = {
  hoje: "var(--color-danger)",
  futuras: "var(--color-info)",
  revisao: "var(--color-warn)",
  concluidas: "var(--color-success)",
};

const PRIORITY_TONE: Record<TaskPriority, [string, string]> = {
  alta: ["var(--color-danger-soft)", "var(--color-danger)"],
  media: ["var(--color-warn-soft)", "var(--color-warn)"],
  baixa: ["var(--color-surface-2)", "var(--color-ink-muted)"],
};

const STATUS_TONE: Record<TaskStatus, [string, string]> = {
  feito: ["var(--color-success-soft)", "var(--color-success)"],
  fazendo: ["var(--color-info-soft)", "var(--color-info)"],
  pendente: ["var(--color-surface-2)", "var(--color-ink-muted)"],
};

export default function TarefasPage() {
  const { scope, revision, isSolo } = useApp();
  const [view, setView] = useState<"quadro" | "lista">("quadro");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<TaskBucket | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState<TaskBucket[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    const [list, pros, pats] = await Promise.all([
      repo.tasks.list(scope),
      repo.team.listProfessionals(scope),
      repo.patients.list(scope, { per_page: 500 }),
    ]);
    setTasks(list);
    setPeople(pros);
    setPatients(pats.items);
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (onlyMine && t.assignee_id !== scope?.profile_id) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, onlyMine, scope]);

  const byBucket = useCallback(
    (bucket: TaskBucket) => visible.filter((t) => t.bucket === bucket),
    [visible],
  );

  const nameOf = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const p = patients.find((x) => x.id === id);
      return p ? `${p.first_name} ${p.last_name ?? ""}`.trim() : null;
    },
    [patients],
  );

  async function drop(bucket: TaskBucket, beforeId?: string | null) {
    if (!scope || !dragging) return;
    await repo.tasks.move(scope, dragging, bucket, beforeId ?? null);
    setDragging(null);
    load();
  }

  if (!scope) return null;

  const late = visible.filter(
    (t) => t.bucket !== "concluidas" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">Organização</p>
          <h1 className="mt-3">Minhas tarefas</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            {visible.length} tarefas ·{" "}
            {byBucket("concluidas").length} concluídas
            {late > 0 && ` · ${late} atrasadas`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating("hoje")}
        >
          <IconPlus width={16} height={16} />
          Nova tarefa
        </button>
      </header>

      {/* ------------------------------------------- barra de controles */}
      <div className="card flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative min-w-[200px] flex-1">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-subtle)]"
          />
          <input
            type="search"
            className="field h-9 pl-9"
            placeholder="Buscar tarefa"
            aria-label="Buscar tarefa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!isSolo && (
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            className={`btn btn-sm ${onlyMine ? "btn-primary" : "btn-outline"}`}
          >
            Somente minhas
          </button>
        )}

        <div className="segmented ml-auto" role="radiogroup" aria-label="Formato">
          {([
            { id: "quadro", label: "Quadro", icon: <IconDashboard width={15} height={15} /> },
            { id: "lista", label: "Lista", icon: <IconRecord width={15} height={15} /> },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              aria-label={v.label}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                view === v.id
                  ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------- QUADRO */}
      {view === "quadro" && (
        <div className="scroll-x pb-2">
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {TASK_BUCKET_ORDER.map((bucket) => {
              const column = byBucket(bucket);
              return (
                <section
                  key={bucket}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(bucket)}
                  className="flex w-[290px] shrink-0 flex-col rounded-[18px] bg-[var(--color-surface-2)] p-3"
                >
                  <header className="mb-3 flex items-center gap-2 px-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: BUCKET_TONE[bucket] }}
                      aria-hidden="true"
                    />
                    <h2 className="flex-1 text-sm">{TASK_BUCKET_LABELS[bucket]}</h2>
                    <span className="tabular font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                      {column.length}
                    </span>
                  </header>

                  <div className="flex-1 space-y-2">
                    {column.map((task) => (
                      <article
                        key={task.id}
                        draggable
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => setDragging(null)}
                        onDrop={(e) => { e.stopPropagation(); drop(bucket, task.id); }}
                        onClick={() => setEditing(task)}
                        className={`card cursor-pointer p-3.5 transition-all hover:shadow-[var(--shadow-lift)] ${
                          dragging === task.id ? "opacity-40" : ""
                        }`}
                      >
                        <p
                          className={`text-sm font-medium leading-snug ${
                            task.status === "feito"
                              ? "text-[var(--color-ink-muted)] line-through"
                              : ""
                          }`}
                        >
                          {task.title}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={PRIORITY_TONE[task.priority]}>
                            {TASK_PRIORITY_LABELS[task.priority]}
                          </Badge>
                          {task.due_date && (
                            <Badge
                              tone={
                                task.due_date < new Date().toISOString().slice(0, 10) &&
                                task.bucket !== "concluidas"
                                  ? PRIORITY_TONE.alta
                                  : ["var(--color-surface-2)", "var(--color-ink-muted)"]
                              }
                            >
                              <IconCalendar width={11} height={11} />
                              {date(`${task.due_date}T12:00:00`)}
                            </Badge>
                          )}
                        </div>

                        <footer className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-2.5">
                          {!isSolo && task.assignee_id && (
                            <Avatar
                              name={
                                people.find((p) => p.id === task.assignee_id)?.full_name ?? "?"
                              }
                              size="xs"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-ink-muted)]">
                            {nameOf(task.patient_id) ??
                              people.find((p) => p.id === task.assignee_id)?.full_name ??
                              "—"}
                          </span>
                          <Badge tone={STATUS_TONE[task.status]}>
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        </footer>
                      </article>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCreating(bucket)}
                      className="flex w-full items-center gap-1.5 rounded-[12px] border border-dashed border-[var(--color-line-strong)] px-3 py-2.5 text-xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      <IconPlus width={13} height={13} />
                      Adicionar tarefa
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ LISTA */}
      {view === "lista" && (
        <div className="space-y-5">
          {TASK_BUCKET_ORDER.map((bucket) => {
            const rows = byBucket(bucket);
            const isCollapsed = collapsed.includes(bucket);
            return (
              <section key={bucket}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) =>
                      c.includes(bucket) ? c.filter((b) => b !== bucket) : [...c, bucket],
                    )
                  }
                  aria-expanded={!isCollapsed}
                  className="mb-2 flex items-center gap-2"
                >
                  <span
                    className="text-[10px] transition-transform"
                    style={{
                      color: BUCKET_TONE[bucket],
                      transform: isCollapsed ? "rotate(-90deg)" : undefined,
                    }}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                  <span
                    className="overline"
                    style={{ color: BUCKET_TONE[bucket] }}
                  >
                    {TASK_BUCKET_LABELS[bucket]}
                  </span>
                  <span
                    className="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 font-[family-name:var(--font-mono)] text-[10px]"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}
                  >
                    {rows.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div
                    className="card overflow-hidden border-l-[3px]"
                    style={{ borderLeftColor: BUCKET_TONE[bucket] }}
                  >
                    {rows.length === 0 ? (
                      <p className="px-5 py-6 text-sm text-[var(--color-ink-muted)]">
                        Nenhuma tarefa em {TASK_BUCKET_LABELS[bucket].toLowerCase()}.
                      </p>
                    ) : (
                      <div className="scroll-x">
                        <table className="w-full text-sm">
                          <caption className="sr-only">
                            {TASK_BUCKET_LABELS[bucket]}
                          </caption>
                          <thead>
                            <tr className="border-b border-[var(--color-line)] text-left">
                              <th scope="col" className="overline px-5 py-2.5">Tarefa</th>
                              {!isSolo && (
                                <th scope="col" className="overline px-5 py-2.5">Responsável</th>
                              )}
                              <th scope="col" className="overline px-5 py-2.5">Status</th>
                              <th scope="col" className="overline px-5 py-2.5">Prazo</th>
                              <th scope="col" className="overline px-5 py-2.5">Prioridade</th>
                              <th scope="col" className="overline px-5 py-2.5">Paciente</th>
                              <th scope="col" className="overline px-5 py-2.5">
                                <span className="sr-only">Ações</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((task) => {
                              const assignee = people.find((p) => p.id === task.assignee_id);
                              const overdue =
                                task.due_date &&
                                task.bucket !== "concluidas" &&
                                task.due_date < new Date().toISOString().slice(0, 10);
                              return (
                                <tr key={task.id} className="table-row">
                                  <td className="px-5 py-3">
                                    <span
                                      className={
                                        task.status === "feito"
                                          ? "text-[var(--color-ink-muted)] line-through"
                                          : "font-medium"
                                      }
                                    >
                                      {task.title}
                                    </span>
                                  </td>
                                  {!isSolo && (
                                    <td className="px-5 py-3">
                                      {assignee ? (
                                        <span className="flex items-center gap-2">
                                          <Avatar name={assignee.full_name} size="xs" />
                                          <span className="truncate text-[var(--color-ink-muted)]">
                                            {assignee.full_name.split(" ")[0]}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-[var(--color-ink-subtle)]">—</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-5 py-3">
                                    <Badge tone={STATUS_TONE[task.status]}>
                                      {TASK_STATUS_LABELS[task.status]}
                                    </Badge>
                                  </td>
                                  <td className="tabular px-5 py-3">
                                    {task.due_date ? (
                                      <span
                                        className={overdue ? "text-[var(--color-danger)]" : ""}
                                      >
                                        {date(`${task.due_date}T12:00:00`)}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--color-ink-subtle)]">
                                        sem data
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3">
                                    <Badge tone={PRIORITY_TONE[task.priority]}>
                                      {TASK_PRIORITY_LABELS[task.priority]}
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-3 text-[var(--color-ink-muted)]">
                                    {nameOf(task.patient_id) ?? "—"}
                                  </td>
                                  <td className="px-5 py-3">
                                    <div className="flex justify-end gap-1">
                                      {task.bucket !== "concluidas" && (
                                        <button
                                          type="button"
                                          aria-label="Concluir"
                                          title="Concluir"
                                          className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-success)]"
                                          onClick={async () => {
                                            await repo.tasks.move(scope, task.id, "concluidas");
                                            load();
                                          }}
                                        >
                                          <IconCheck width={15} height={15} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setEditing(task)}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="Excluir"
                                        className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-danger)]"
                                        onClick={() => setRemoving(task)}
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

                    <button
                      type="button"
                      onClick={() => setCreating(bucket)}
                      className="flex w-full items-center gap-1.5 border-t border-[var(--color-line)] px-5 py-2.5 text-xs text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      <IconPlus width={13} height={13} />
                      Adicionar tarefa
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TaskModal
        open={creating !== null || editing !== null}
        task={editing}
        bucket={creating ?? editing?.bucket ?? "hoje"}
        people={people}
        patients={patients}
        onClose={() => { setCreating(null); setEditing(null); }}
        onSaved={() => { setCreating(null); setEditing(null); load(); }}
        onDelete={editing ? () => { setRemoving(editing); setEditing(null); } : undefined}
      />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Excluir tarefa"
        description={`"${removing?.title}" será removida permanentemente.`}
        confirmLabel="Excluir tarefa"
        onConfirm={async () => {
          if (!removing) return;
          await repo.tasks.remove(scope, removing.id);
          setRemoving(null);
          load();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- apoio */

function Badge({
  tone,
  children,
}: {
  tone: [string, string];
  children: React.ReactNode;
}) {
  return (
    <span
      className="badge badge-plain gap-1"
      style={{ background: tone[0], color: tone[1] }}
    >
      {children}
    </span>
  );
}

function TaskModal({
  open, task, bucket, people, patients, onClose, onSaved, onDelete,
}: {
  open: boolean;
  task: Task | null;
  bucket: TaskBucket;
  people: Profile[];
  patients: Patient[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { scope } = useApp();
  const [form, setForm] = useState({
    title: "", description: "", bucket, status: "pendente" as TaskStatus,
    priority: "media" as TaskPriority, due_date: "", assignee_id: "", patient_id: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      title: task?.title ?? "",
      description: task?.description ?? "",
      bucket: task?.bucket ?? bucket,
      status: task?.status ?? "pendente",
      priority: task?.priority ?? "media",
      due_date: task?.due_date ?? "",
      assignee_id: task?.assignee_id ?? scope?.profile_id ?? "",
      patient_id: task?.patient_id ?? "",
    });
  }, [open, task, bucket, scope]);

  async function save() {
    if (!scope) return;
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        bucket: form.bucket,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        assignee_id: form.assignee_id || null,
        patient_id: form.patient_id || null,
      };
      if (task) await repo.tasks.update(scope, task.id, payload);
      else await repo.tasks.create(scope, payload);
      onSaved();
    } catch (e) { setError(messageFor(e)); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Editar tarefa" : "Nova tarefa"}
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-sm mr-auto text-[var(--color-danger)]"
              onClick={onDelete}
            >
              Excluir
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!form.title.trim()}
          >
            {task ? "Salvar" : "Criar tarefa"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ttitulo">Tarefa</label>
          <input
            id="ttitulo"
            className="field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: enviar guias da Petrobras"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="tdesc">Detalhes</label>
          <textarea
            id="tdesc"
            rows={3}
            className="field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <span className="label">Seção</span>
          <Select
            label="Seção"
            value={form.bucket}
            onChange={(v) => setForm({ ...form, bucket: v as TaskBucket })}
            options={TASK_BUCKET_ORDER.map((b) => ({
              value: b,
              label: TASK_BUCKET_LABELS[b],
            }))}
          />
        </div>

        <div>
          <span className="label">Status</span>
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v as TaskStatus })}
            options={(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => ({
              value: s,
              label: TASK_STATUS_LABELS[s],
            }))}
          />
        </div>

        <div>
          <span className="label">Prioridade</span>
          <Select
            label="Prioridade"
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: v as TaskPriority })}
            options={(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => ({
              value: p,
              label: TASK_PRIORITY_LABELS[p],
            }))}
          />
        </div>

        <div>
          <label className="label" htmlFor="tprazo">Prazo</label>
          <input
            id="tprazo"
            type="date"
            className="field"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>

        {people.length > 1 && (
        <div>
          <span className="label">Responsável</span>
          <Select
            label="Responsável"
            value={form.assignee_id}
            onChange={(v) => setForm({ ...form, assignee_id: v })}
            options={[
              { value: "", label: "Sem responsável" },
              ...people.map((p) => ({ value: p.id, label: p.full_name })),
            ]}
          />
        </div>
        )}

        <div>
          <span className="label">Paciente relacionado</span>
          <Select
            label="Paciente relacionado"
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            options={[
              { value: "", label: "Nenhum" },
              ...patients.slice(0, 200).map((p) => ({
                value: p.id,
                label: `${p.first_name} ${p.last_name ?? ""}`.trim(),
              })),
            ]}
          />
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

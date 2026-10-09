"use client";

/**
 * Assistente — exemplo de camada de IA sobre os dados da clínica.
 *
 * As respostas vêm de REGRAS sobre a base real, não de um modelo. É proposital:
 * mostra o formato e o valor que a IA entregaria, sem custo de API e sem risco
 * de inventar número numa apresentação. Na fase 2 só a função `answer` muda.
 *
 * O assistente nunca lê conteúdo clínico — apenas metadados, contagem e valor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo } from "@/lib/repository";
import { readDatabase } from "@/lib/repository/store";
import { buildInsights } from "@/lib/insights";
import { ASSISTANT_NAME, ASSISTANT_TAGLINE } from "@/lib/assistant-identity";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { brl, pct } from "@/lib/format";
import { hasPermission, type AiConversation, type AiFolder, type Patient, type Scope } from "@/lib/domain/types";
import {
  IconLock, IconMore, IconPlus, IconRecord, IconSearch, IconSend,
  IconSparkle, IconX,
} from "@/components/icons";

const SUGGESTIONS = [
  "Como está a taxa de faltas?",
  "Quanto a Petrobras ainda me deve?",
  "Quantas sessões tenho esta semana?",
  "Quais pacientes estão faltando muito?",
  "Resumo do mês",
];

const TODAY = new Date(2026, 7, 17, 12);

/* --------------------------------------------------------- respostas */

function answer(question: string, scope: Scope): string {
  const q = question.toLowerCase();
  const db = readDatabase();
  const appointments = db.appointments.filter((a) => a.org_id === scope.org_id);
  const entries = db.financial_entries.filter((e) => e.org_id === scope.org_id);
  const patients = db.patients.filter((p) => p.org_id === scope.org_id);
  const plans = db.health_plans.filter((p) => p.org_id === scope.org_id);
  const profiles = db.profiles;

  const monthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  const inMonth = appointments.filter((a) => new Date(a.starts_at) >= monthStart);

  if (/falta|no.?show|absente/.test(q)) {
    const finished = inMonth.filter((a) => ["attended", "no_show"].includes(a.status));
    const noShow = finished.filter((a) => a.status === "no_show").length;
    const rate = finished.length ? (noShow / finished.length) * 100 : 0;
    const worst = patients
      .filter((p) => p.no_show_count > 0)
      .sort((a, b) => b.no_show_count - a.no_show_count)
      .slice(0, 3);
    return [
      `A taxa de faltas do mês está em ${pct(rate)}: ${noShow} faltas em ${finished.length} sessões finalizadas.`,
      worst.length
        ? `Quem mais falta: ${worst.map((p) => `${p.first_name} ${p.last_name ?? ""} (${p.no_show_count})`.trim()).join(", ")}.`
        : "",
      "Confirmar por telefone no dia anterior costuma reduzir bastante esse número.",
    ].filter(Boolean).join("\n\n");
  }

  if (/deve|receber|glosa|fatur|convênio|convenio|petrobras|dinheiro|receita/.test(q)) {
    if (!hasPermission(scope, "finance.read.all")) {
      return "Você não tem acesso aos números consolidados do financeiro.";
    }
    const byPlan = plans.map((plan) => {
      const rows = entries.filter((e) => e.health_plan_id === plan.id);
      return {
        name: plan.name,
        aberto: rows.filter((e) => e.status === "previsto" || e.status === "faturado")
          .reduce((s, e) => s + e.gross_amount, 0),
        glosado: rows.filter((e) => e.status === "glosado").reduce((s, e) => s + e.gross_amount, 0),
      };
    }).sort((a, b) => b.aberto - a.aberto);

    const totalGlosa = byPlan.reduce((s, p) => s + p.glosado, 0);
    return [
      "Situação por operadora:",
      byPlan.map((p) => `• ${p.name}: ${brl(p.aberto)} em aberto${p.glosado ? ` e ${brl(p.glosado)} glosado` : ""}`).join("\n"),
      totalGlosa > 0
        ? `As glosas somam ${brl(totalGlosa)}: é o dinheiro mais rápido de recuperar, já que a sessão já foi prestada.`
        : "",
    ].filter(Boolean).join("\n\n");
  }

  if (/espaço|espaco|agenda|ocupa|livre|disponib|semana|hoje/.test(q)) {
    const weekStart = new Date(TODAY);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const week = appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d >= weekStart && d < weekEnd && a.status !== "cancelled";
    });
    const todayKey = TODAY.toISOString().slice(0, 10);
    const today = week.filter((a) => a.starts_at.startsWith(todayKey));
    const ahead = week.filter((a) => new Date(a.starts_at) > TODAY);

    return [
      `Esta semana você tem ${week.length} sessões, sendo ${today.length} hoje.`,
      ahead.length
        ? `Ainda faltam ${ahead.length} até o fim da semana.`
        : "Não há mais sessões marcadas nesta semana.",
      `No mês, ${inMonth.filter((a) => a.status === "attended").length} sessões já foram atendidas.`,
    ].join("\n\n");
  }

  if (/paciente/.test(q)) {
    const ativos = patients.filter((p) => p.status === "active").length;
    const convenio = patients.filter((p) => p.payment_type === "convenio").length;
    return `São ${patients.length} pacientes cadastrados, ${ativos} ativos. ${convenio} por convênio e ${patients.length - convenio} particulares.`;
  }

  if (/resumo|geral|como est|panorama|mês|mes/.test(q)) {
    const insights = buildInsights({
      today: TODAY, appointments, entries, patients, professionals: profiles, plans,
    });
    const atendidas = inMonth.filter((a) => a.status === "attended").length;
    const recebido = entries
      .filter((e) => e.status === "recebido" && new Date(e.created_at) >= monthStart)
      .reduce((s, e) => s + e.gross_amount, 0);
    return [
      `No mês: ${atendidas} sessões atendidas${hasPermission(scope, "finance.read.all") ? ` e ${brl(recebido)} recebidos` : ""}.`,
      insights.length ? "Pontos de atenção:" : "",
      insights.slice(0, 3).map((i) => `• ${i.title}: ${i.body}`).join("\n"),
    ].filter(Boolean).join("\n\n");
  }

  return [
    "Ainda não sei responder isso nesta versão de demonstração.",
    "Posso ajudar com: taxa de faltas, situação por convênio, sessões da semana, pacientes e resumo do mês.",
  ].join("\n\n");
}

/* ------------------------------------------------------------ página */

export default function AssistentePage() {
  const { scope, profile, revision } = useApp();
  const [folders, setFolders] = useState<AiFolder[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AiConversation | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    const [f, c, p] = await Promise.all([
      repo.assistant.listFolders(scope),
      repo.assistant.listConversations(scope),
      repo.patients.list(scope, { per_page: 500 }),
    ]);
    setFolders(f);
    setConversations(c);
    setPatients(p.items);
    return c;
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  const current = conversations.find((c) => c.id === currentId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current?.messages.length, typing]);

  async function newConversation(folderId?: string | null, patientId?: string | null) {
    if (!scope) return;
    const created = await repo.assistant.createConversation(scope, {
      folder_id: folderId ?? null,
      patient_id: patientId ?? null,
    });
    await load();
    setCurrentId(created.id);
    setSidebarOpen(false);
  }

  async function send(text: string) {
    if (!scope || !text.trim()) return;
    const question = text.trim();
    setInput("");

    let id = currentId;
    if (!id) {
      const created = await repo.assistant.createConversation(scope);
      id = created.id;
      setCurrentId(id);
    }

    await repo.assistant.appendMessage(scope, id, { from: "user", text: question });
    await load();
    setTyping(true);

    const reply = answer(question, scope);
    window.setTimeout(async () => {
      await repo.assistant.appendMessage(scope, id!, { from: "ai", text: reply });
      await load();
      setTyping(false);
    }, 550);
  }

  if (!scope || !profile) return null;

  const q = search.trim().toLowerCase();
  const matches = (c: AiConversation) => !q || c.title.toLowerCase().includes(q);
  const pinned = conversations.filter((c) => c.is_pinned && matches(c));
  const loose = conversations.filter((c) => !c.is_pinned && !c.folder_id && matches(c));

  const patientName = (id: string | null) => {
    if (!id) return null;
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name ?? ""}`.trim() : null;
  };

  /* ---------------------------------------------------- item da lista */
  function ConversationRow({ c }: { c: AiConversation }) {
    const active = c.id === currentId;
    return (
      <li className="group relative">
        <button
          type="button"
          onClick={() => { setCurrentId(c.id); setSidebarOpen(false); }}
          className={`flex w-full items-center gap-2 rounded-[9px] py-1.5 pl-2.5 pr-8 text-left text-[13px] transition-colors ${
            active
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
              : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          }`}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background: c.is_pinned ? "var(--color-gold)" : "var(--color-line-strong)",
            }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{c.title}</span>
        </button>

        <button
          type="button"
          aria-label="Opções da conversa"
          onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
          className="absolute right-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface)] group-hover:grid"
        >
          <IconMore width={14} height={14} />
        </button>

        {menuFor === c.id && (
          <div className="card absolute right-1 top-8 z-30 w-48 p-1 text-sm">
            <MenuItem
              onClick={async () => {
                await repo.assistant.updateConversation(scope!, c.id, {
                  is_pinned: !c.is_pinned,
                });
                setMenuFor(null);
                load();
              }}
            >
              {c.is_pinned ? "Desafixar" : "Fixar conversa"}
            </MenuItem>

            {folders.length > 0 && (
              <>
                <p className="overline px-2.5 pb-1 pt-2">Mover para</p>
                {folders.map((f) => (
                  <MenuItem
                    key={f.id}
                    onClick={async () => {
                      await repo.assistant.updateConversation(scope!, c.id, {
                        folder_id: f.id,
                      });
                      setMenuFor(null);
                      load();
                    }}
                  >
                    {f.name}
                  </MenuItem>
                ))}
                {c.folder_id && (
                  <MenuItem
                    onClick={async () => {
                      await repo.assistant.updateConversation(scope!, c.id, {
                        folder_id: null,
                      });
                      setMenuFor(null);
                      load();
                    }}
                  >
                    Tirar da pasta
                  </MenuItem>
                )}
              </>
            )}

            <MenuItem
              danger
              onClick={() => { setRemoving(c); setMenuFor(null); }}
            >
              Excluir
            </MenuItem>
          </div>
        )}
      </li>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          className="btn btn-primary btn-sm w-full"
          onClick={() => newConversation()}
        >
          <IconPlus width={15} height={15} />
          Nova conversa
        </button>

        <div className="relative mt-3">
          <IconSearch
            width={14}
            height={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-subtle)]"
          />
          <input
            type="search"
            className="field h-8 pl-8 text-[13px]"
            placeholder="Buscar conversa"
            aria-label="Buscar conversa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {/* ------------------------------------------------- pastas */}
        <section>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <p className="overline">Pastas</p>
            <button
              type="button"
              aria-label="Nova pasta"
              title="Nova pasta"
              className="grid h-5 w-5 place-items-center rounded text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
              onClick={() => setFolderModal(true)}
            >
              <IconPlus width={13} height={13} />
            </button>
          </div>

          {folders.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-[var(--color-ink-subtle)]">
              Crie uma pasta para agrupar conversas sobre um paciente.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {folders.map((folder) => {
                const inside = conversations.filter(
                  (c) => c.folder_id === folder.id && matches(c),
                );
                return (
                  <li key={folder.id}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1">
                      <IconRecord
                        width={13}
                        height={13}
                        className="shrink-0 text-[var(--color-gold)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {folder.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Nova conversa em ${folder.name}`}
                        title="Nova conversa nesta pasta"
                        className="grid h-5 w-5 place-items-center rounded text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                        onClick={() => newConversation(folder.id, folder.patient_id)}
                      >
                        <IconPlus width={12} height={12} />
                      </button>
                    </div>
                    {inside.length > 0 && (
                      <ul className="ml-3 space-y-0.5 border-l border-[var(--color-line)] pl-1.5">
                        {inside.map((c) => <ConversationRow key={c.id} c={c} />)}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------ fixadas */}
        {pinned.length > 0 && (
          <section>
            <p className="overline mb-1.5 px-1">Fixadas</p>
            <ul className="space-y-0.5">
              {pinned.map((c) => <ConversationRow key={c.id} c={c} />)}
            </ul>
          </section>
        )}

        {/* ------------------------------------------------ recentes */}
        <section>
          <p className="overline mb-1.5 px-1">Conversas</p>
          {loose.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-[var(--color-ink-subtle)]">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {loose.map((c) => <ConversationRow key={c.id} c={c} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 gap-3 md:gap-4">
      {/* -------------------------------------------- barra lateral */}
      <aside className="card hidden w-[264px] shrink-0 overflow-hidden lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Fechar"
                className="btn btn-ghost h-8 w-8 !px-0"
                onClick={() => setSidebarOpen(false)}
              >
                <IconX width={16} height={16} />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- conversa */}
      <div className="card flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
          <button
            type="button"
            aria-label="Conversas"
            className="btn btn-ghost h-8 w-8 !px-0 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <IconMore width={17} height={17} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {current?.title ?? ASSISTANT_NAME}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-[var(--color-ink-subtle)]">
              <IconLock width={11} height={11} />
              {patientName(current?.patient_id ?? null)
                ? `Sobre ${patientName(current!.patient_id)} · sem acesso a prontuário`
                : ASSISTANT_TAGLINE}
            </p>
          </div>

          {current && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await repo.assistant.updateConversation(scope, current.id, {
                  is_pinned: !current.is_pinned,
                });
                load();
              }}
              title={current.is_pinned ? "Desafixar" : "Fixar conversa"}
            >
              <span style={{ color: current.is_pinned ? "var(--color-gold-ink)" : undefined }}>
                ★
              </span>
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!current || current.messages.length === 0 ? (
            <div className="grid h-full place-content-center justify-items-center text-center">
              <span
                className="icon-chip mb-3 h-11 w-11"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
              >
                <IconSparkle width={20} height={20} />
              </span>
              <p className="font-medium">
                Oi, {profile.full_name.split(" ")[0]}. Sou a {ASSISTANT_NAME}.
              </p>
              <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">
                Resumo a sua rotina, aponto risco de falta e mostro o que
                cada convênio ainda deve. Não tenho acesso ao conteúdo de nenhuma
                evolução.
              </p>
            </div>
          ) : (
            current.messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.from === "user" ? "justify-end" : ""}`}>
                {m.from === "ai" && (
                  <span
                    className="icon-chip h-8 w-8 shrink-0"
                    style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                    aria-hidden="true"
                  >
                    <IconSparkle width={16} height={16} />
                  </span>
                )}
                <div
                  className={`max-w-[78%] whitespace-pre-wrap rounded-[16px] px-4 py-2.5 text-sm leading-relaxed ${
                    m.from === "user"
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface-2)]"
                  }`}
                  style={m.from === "user" ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}

          {typing && (
            <div className="flex gap-3">
              <span
                className="icon-chip h-8 w-8 shrink-0"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                aria-hidden="true"
              >
                <IconSparkle width={16} height={16} />
              </span>
              <div className="flex items-center gap-1 rounded-[16px] bg-[var(--color-surface-2)] px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink-subtle)]"
                    style={{ animation: `pulse 1s ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[var(--color-line)] p-3">
          {(!current || current.messages.length === 0) && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              className="field"
              placeholder="Pergunte sobre a sua rotina…"
              aria-label="Sua pergunta"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!input.trim()} aria-label="Enviar">
              <IconSend width={16} height={16} />
            </button>
          </form>
        </div>
      </div>

      <FolderModal
        open={folderModal}
        patients={patients}
        onClose={() => setFolderModal(false)}
        onCreated={() => { setFolderModal(false); load(); }}
      />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Excluir conversa"
        description={`"${removing?.title}" e todas as mensagens dela serão removidas.`}
        confirmLabel="Excluir conversa"
        onConfirm={async () => {
          if (!removing) return;
          await repo.assistant.deleteConversation(scope, removing.id);
          if (currentId === removing.id) setCurrentId(null);
          setRemoving(null);
          load();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- apoio */

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--color-surface-2)] ${
        danger ? "text-[var(--color-danger)]" : ""
      }`}
    >
      {children}
    </button>
  );
}

function FolderModal({
  open, patients, onClose, onCreated,
}: {
  open: boolean;
  patients: Patient[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { scope } = useApp();
  const [name, setName] = useState("");
  const [patientId, setPatientId] = useState("");

  useEffect(() => {
    if (open) { setName(""); setPatientId(""); }
  }, [open]);

  // Escolher o paciente já nomeia a pasta — evita digitar o nome duas vezes.
  useEffect(() => {
    if (!patientId) return;
    const p = patients.find((x) => x.id === patientId);
    if (p) setName(`${p.first_name} ${p.last_name ?? ""}`.trim());
  }, [patientId, patients]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Nova pasta"
      description="Agrupe conversas por assunto ou por paciente."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!name.trim()}
            onClick={async () => {
              if (!scope) return;
              await repo.assistant.createFolder(scope, {
                name,
                patient_id: patientId || null,
              });
              onCreated();
            }}
          >
            Criar pasta
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Paciente (opcional)</span>
          <Select
            label="Paciente da pasta"
            value={patientId}
            onChange={setPatientId}
            options={[
              { value: "", label: "Nenhum, pasta por assunto" },
              ...patients.slice(0, 200).map((p) => ({
                value: p.id,
                label: `${p.first_name} ${p.last_name ?? ""}`.trim(),
              })),
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="fname">Nome da pasta</label>
          <input
            id="fname"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Faturamento Petrobras"
          />
        </div>
      </div>
    </Modal>
  );
}

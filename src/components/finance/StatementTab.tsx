"use client";

/**
 * Extrato bancário: importar e conciliar.
 *
 * A linha do extrato NÃO vira lançamento sozinha. Extrato traz aluguel, tarifa
 * e Pix de terceiro junto com a receita da clínica, então cada linha é
 * conciliada com um lançamento existente, ignorada, ou fica pendente.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { parseStatement, type ParsedLine } from "@/lib/statement-parsers";
import { brl, date } from "@/lib/format";
import type { BankTransaction, FinancialEntry, Patient } from "@/lib/domain/types";
import { IconAlert, IconCheck, IconPlus, IconX } from "@/components/icons";

type Filter = "pendentes" | "conciliadas" | "ignoradas" | "todas";

export function StatementTab({
  entries,
  patients,
}: {
  entries: FinancialEntry[];
  patients: Map<string, Patient>;
}) {
  const { scope, revision } = useApp();
  const [rows, setRows] = useState<BankTransaction[]>([]);
  const [filter, setFilter] = useState<Filter>("pendentes");
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState<BankTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    try {
      setRows(await repo.finance.listTransactions(scope));
    } catch (e) {
      setError(messageFor(e));
    }
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  if (!scope) return null;

  const visible = rows.filter((t) => {
    if (filter === "pendentes") return !t.matched_entry_id && !t.ignored;
    if (filter === "conciliadas") return Boolean(t.matched_entry_id);
    if (filter === "ignoradas") return t.ignored;
    return true;
  });

  const pending = rows.filter((t) => !t.matched_entry_id && !t.ignored);
  const entradas = pending
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2>Extrato bancário</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            Importe o extrato do banco e concilie cada entrada com o lançamento
            correspondente. Conciliar marca o lançamento como recebido.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setImporting(true)}
        >
          <IconPlus width={15} height={15} />
          Importar extrato
        </button>
      </div>

      {rows.length > 0 && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          <MiniCard label="Linhas importadas" value={String(rows.length)} />
          <MiniCard label="A conciliar" value={String(pending.length)} tone="warn" />
          <MiniCard label="Entradas pendentes" value={brl(entradas)} tone="info" />
          <MiniCard
            label="Conciliadas"
            value={String(rows.filter((t) => t.matched_entry_id).length)}
            tone="success"
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span
            className="icon-chip mb-3"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink-subtle)" }}
          >
            <IconAlert />
          </span>
          <p className="font-medium">Nenhum extrato importado</p>
          <p className="mt-1 max-w-md text-sm text-[var(--color-ink-muted)]">
            Baixe o extrato no aplicativo do banco em CSV ou OFX e importe aqui.
            O sistema lê data, descrição e valor, e sugere com qual lançamento
            cada entrada combina.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4"
            onClick={() => setImporting(true)}
          >
            <IconPlus width={15} height={15} />
            Importar extrato
          </button>
        </div>
      ) : (
        <>
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <div className="segmented">
              {([
                { id: "pendentes", label: "A conciliar" },
                { id: "conciliadas", label: "Conciliadas" },
                { id: "ignoradas", label: "Ignoradas" },
                { id: "todas", label: "Todas" },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    filter === f.id
                      ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
                      : "text-[var(--color-ink-muted)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--color-ink-muted)]">
                Nenhuma linha nesta situação.
              </p>
            ) : (
              <div className="scroll-x">
                <table className="w-full text-sm">
                  <caption className="sr-only">Linhas do extrato</caption>
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-left">
                      <th scope="col" className="overline px-5 py-3">Data</th>
                      <th scope="col" className="overline px-5 py-3">Descrição</th>
                      <th scope="col" className="overline px-5 py-3">Valor</th>
                      <th scope="col" className="overline px-5 py-3">Situação</th>
                      <th scope="col" className="overline px-5 py-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 200).map((t) => {
                      const entry = entries.find((e) => e.id === t.matched_entry_id);
                      const patient = entry
                        ? patients.get(entry.patient_id)
                        : undefined;
                      return (
                        <tr key={t.id} className="table-row">
                          <td className="tabular px-5 py-3 text-[var(--color-ink-muted)]">
                            {date(`${t.date}T12:00:00`)}
                          </td>
                          <td className="px-5 py-3">
                            <span className="block max-w-[320px] truncate">
                              {t.description}
                            </span>
                            {entry && (
                              <span className="block text-xs text-[var(--color-ink-subtle)]">
                                {patient
                                  ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
                                  : "Lançamento conciliado"}
                              </span>
                            )}
                          </td>
                          <td
                            className={`tabular px-5 py-3 font-[family-name:var(--font-mono)] ${
                              t.amount < 0 ? "text-[var(--color-danger)]" : ""
                            }`}
                          >
                            {brl(t.amount)}
                          </td>
                          <td className="px-5 py-3">
                            {t.matched_entry_id ? (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--color-success-soft)",
                                  color: "var(--color-success)",
                                }}
                              >
                                Conciliada
                              </span>
                            ) : t.ignored ? (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--color-surface-2)",
                                  color: "var(--color-ink-subtle)",
                                }}
                              >
                                Ignorada
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--color-warn-soft)",
                                  color: "var(--color-warn)",
                                }}
                              >
                                A conciliar
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              {t.matched_entry_id ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={async () => {
                                    await repo.finance.matchTransaction(scope, t.id, null);
                                    load();
                                  }}
                                >
                                  Desfazer
                                </button>
                              ) : (
                                t.amount > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setMatching(t)}
                                  >
                                    Conciliar
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm text-[var(--color-ink-muted)]"
                                onClick={async () => {
                                  await repo.finance.ignoreTransaction(scope, t.id);
                                  load();
                                }}
                              >
                                {t.ignored ? "Restaurar" : "Ignorar"}
                              </button>
                              <button
                                type="button"
                                aria-label="Excluir linha"
                                className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-danger)]"
                                onClick={async () => {
                                  await repo.finance.removeTransaction(scope, t.id);
                                  load();
                                }}
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

      <ImportModal
        open={importing}
        onClose={() => setImporting(false)}
        onDone={() => { setImporting(false); load(); }}
      />

      <MatchModal
        transaction={matching}
        entries={entries}
        patients={patients}
        onClose={() => setMatching(null)}
        onDone={() => { setMatching(null); load(); }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- apoio */

function MiniCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn" | "info" | "success";
}) {
  const colors = {
    neutral: "var(--color-ink)",
    warn: "var(--color-warn)",
    info: "var(--color-info)",
    success: "var(--color-success)",
  }[tone];

  return (
    <div className="card p-4">
      <p className="overline">{label}</p>
      <p
        className="tabular mt-1.5 font-[family-name:var(--font-mono)] text-lg leading-none"
        style={{ color: colors }}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ importar */

function ImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { scope } = useApp();
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<"csv" | "ofx" | "pdf">("csv");
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLines([]); setSelected(new Set()); setFileName(null);
      setWarning(null); setResult(null);
    }
  }, [open]);

  const read = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const text = file.name.toLowerCase().endsWith(".pdf")
      ? ""
      : await file.text();
    const parsed = parseStatement(file.name, text);

    setSource(parsed.source);
    setLines(parsed.lines);
    setSelected(new Set(parsed.lines.map((_, i) => i)));
    setWarning(parsed.warning ?? null);
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Importar extrato"
      description="CSV e OFX são lidos automaticamente."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {result ? "Fechar" : "Cancelar"}
          </button>
          {lines.length > 0 && !result && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={selected.size === 0}
              onClick={async () => {
                if (!scope) return;
                const chosen = lines.filter((_, i) => selected.has(i));
                const r = await repo.finance.importTransactions(scope, chosen, {
                  source,
                  file_name: fileName,
                });
                setResult(
                  `${r.imported} linhas importadas` +
                    (r.duplicates ? `, ${r.duplicates} já existiam e foram puladas.` : "."),
                );
                onDone();
              }}
            >
              Importar {selected.size} linhas
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            read(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-[16px] border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
              : "border-[var(--color-line-strong)]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.ofx,.xml,.pdf"
            className="sr-only"
            aria-label="Arquivo do extrato"
            onChange={(e) => read(e.target.files?.[0])}
          />
          <p className="text-sm font-medium">
            {fileName ?? "Arraste o arquivo do extrato aqui"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            CSV, OFX, XML ou PDF
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm mt-3"
            onClick={() => inputRef.current?.click()}
          >
            Escolher arquivo
          </button>
        </div>

        {warning && (
          <div className="flex gap-2.5 rounded-[14px] bg-[var(--color-warn-soft)] p-3.5">
            <IconAlert
              width={17}
              height={17}
              style={{ color: "var(--color-warn)" }}
              className="mt-0.5 shrink-0"
            />
            <p className="text-sm">{warning}</p>
          </div>
        )}

        {result && (
          <p className="flex items-center gap-2 rounded-[14px] bg-[var(--color-success-soft)] p-3.5 text-sm text-[var(--color-success)]">
            <IconCheck width={16} height={16} />
            {result}
          </p>
        )}

        {lines.length > 0 && !result && (
          <>
            <div className="flex items-center justify-between">
              <p className="overline">
                {lines.length} linhas lidas · {selected.size} marcadas
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setSelected(
                    selected.size === lines.length
                      ? new Set()
                      : new Set(lines.map((_, i) => i)),
                  )
                }
              >
                {selected.size === lines.length ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-[14px] border border-[var(--color-line)]">
              <table className="w-full text-sm">
                <caption className="sr-only">Prévia do extrato</caption>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={`${line.date}-${i}`} className="table-row">
                      <td className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Importar linha de ${line.description}`}
                          checked={selected.has(i)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="tabular px-2 py-2 text-xs text-[var(--color-ink-muted)]">
                        {date(`${line.date}T12:00:00`)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="block max-w-[280px] truncate">
                          {line.description}
                        </span>
                      </td>
                      <td
                        className={`tabular px-3 py-2 text-right font-[family-name:var(--font-mono)] ${
                          line.amount < 0 ? "text-[var(--color-danger)]" : ""
                        }`}
                      >
                        {brl(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ conciliar */

function MatchModal({
  transaction,
  entries,
  patients,
  onClose,
  onDone,
}: {
  transaction: BankTransaction | null;
  entries: FinancialEntry[];
  patients: Map<string, Patient>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { scope } = useApp();
  const [choice, setChoice] = useState("");
  const [suggested, setSuggested] = useState<FinancialEntry | null>(null);

  useEffect(() => {
    if (!transaction || !scope) return;
    setChoice("");
    repo.finance.suggestMatch(scope, transaction.id).then((s) => {
      setSuggested(s);
      if (s) setChoice(s.id);
    });
  }, [transaction, scope]);

  if (!transaction || !scope) return null;

  const nameOf = (entry: FinancialEntry) => {
    const p = patients.get(entry.patient_id);
    const name = p ? `${p.first_name} ${p.last_name ?? ""}`.trim() : "Paciente";
    return `${name} · ${brl(entry.gross_amount)} · ${date(entry.created_at)}`;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Conciliar com lançamento"
      description={`${date(`${transaction.date}T12:00:00`)} · ${brl(transaction.amount)}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!choice}
            onClick={async () => {
              await repo.finance.matchTransaction(scope, transaction.id, choice);
              onDone();
            }}
          >
            Conciliar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-[14px] bg-[var(--color-surface-2)] p-3.5 text-sm">
          {transaction.description}
        </p>

        {suggested && (
          <p className="flex items-start gap-2 text-sm text-[var(--color-success)]">
            <IconCheck width={16} height={16} className="mt-0.5 shrink-0" />
            Encontrei um lançamento com o mesmo valor. Confira antes de confirmar.
          </p>
        )}

        <div>
          <span className="label">Lançamento correspondente</span>
          <Select
            label="Lançamento correspondente"
            value={choice}
            onChange={setChoice}
            options={[
              { value: "", label: "Escolha um lançamento" },
              ...entries
                .slice(0, 300)
                .map((e) => ({ value: e.id, label: nameOf(e) })),
            ]}
          />
        </div>

        <p className="text-xs text-[var(--color-ink-muted)]">
          Conciliar marca o lançamento como recebido, com a data do extrato.
        </p>
      </div>
    </Modal>
  );
}

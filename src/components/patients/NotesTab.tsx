"use client";

/**
 * Anotações administrativas do paciente.
 *
 * Não confundir com prontuário: aqui vai recado de recepção, preferência de
 * horário, combinado de pagamento. Conteúdo clínico continua exclusivamente
 * em Prontuários, sob a regra de sigilo.
 */

import { useCallback, useEffect, useState } from "react";
import { repo, messageFor } from "@/lib/repository";
import { Avatar } from "@/components/ui/Avatar";
import { date, time } from "@/lib/format";
import { NOTE_KIND_LABELS, type PatientNote, type Profile, type Scope } from "@/lib/domain/types";
import { IconPlus, IconRecord, IconX } from "@/components/icons";

const KIND_TONE: Record<PatientNote["kind"], [string, string]> = {
  geral: ["var(--color-surface-2)", "var(--color-ink-muted)"],
  contato: ["var(--color-info-soft)", "var(--color-info)"],
  financeiro: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
  agenda: ["var(--color-accent-soft)", "var(--color-accent-ink)"],
};

export function NotesTab({
  scope,
  patientId,
  professionals,
}: {
  scope: Scope;
  patientId: string;
  professionals: Profile[];
}) {
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<PatientNote["kind"]>("geral");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNotes(await repo.patients.listNotes(scope, patientId));
  }, [scope, patientId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!content.trim()) return;
    try {
      await repo.patients.addNote(scope, patientId, { content, kind });
      setContent("");
      setKind("geral");
      load();
    } catch (e) { setError(messageFor(e)); }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ nova anotação */}
      <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3.5">
        <textarea
          rows={3}
          className="field"
          placeholder="Ex.: prefere horário após as 18h; pediu recibo mensal; avisar sempre por WhatsApp."
          aria-label="Nova anotação"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="segmented">
            {(Object.keys(NOTE_KIND_LABELS) as PatientNote["kind"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  kind === k
                    ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                {NOTE_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto"
            onClick={add}
            disabled={!content.trim()}
          >
            <IconPlus width={15} height={15} />
            Anotar
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------- lista */}
      {notes.length === 0 ? (
        <div className="grid place-items-center py-10 text-center">
          <IconRecord width={22} height={22} className="mb-2 text-[var(--color-ink-subtle)]" />
          <p className="text-sm text-[var(--color-ink-muted)]">
            Nenhuma anotação ainda.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => {
            const author = professionals.find((p) => p.id === note.author_id);
            const [bg, fg] = KIND_TONE[note.kind];
            const isEditing = editing === note.id;

            return (
              <li
                key={note.id}
                className={`rounded-[16px] border p-3.5 ${
                  note.is_pinned
                    ? "border-[var(--color-gold)] bg-[var(--color-gold-soft)]"
                    : "border-[var(--color-line)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={author?.full_name ?? "?"} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {author?.full_name ?? "—"}
                      </span>
                      <span
                        className="badge badge-plain"
                        style={{ background: bg, color: fg }}
                      >
                        {NOTE_KIND_LABELS[note.kind]}
                      </span>
                      <span className="tabular text-xs text-[var(--color-ink-subtle)]">
                        {date(note.created_at)} {time(note.created_at)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          rows={3}
                          className="field"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          aria-label="Editar anotação"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await repo.patients.updateNote(scope, note.id, { content: draft });
                              setEditing(null);
                              load();
                            }}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditing(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                        {note.content}
                      </p>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        aria-label={note.is_pinned ? "Desafixar" : "Fixar no topo"}
                        title={note.is_pinned ? "Desafixar" : "Fixar no topo"}
                        className="btn btn-ghost h-7 w-7 !px-0 text-xs"
                        onClick={async () => {
                          await repo.patients.updateNote(scope, note.id, {
                            is_pinned: !note.is_pinned,
                          });
                          load();
                        }}
                      >
                        <span style={{ color: note.is_pinned ? "var(--color-gold-ink)" : undefined }}>
                          ★
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Editar"
                        title="Editar"
                        className="btn btn-ghost h-7 w-7 !px-0 text-xs"
                        onClick={() => { setEditing(note.id); setDraft(note.content); }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        aria-label="Excluir"
                        title="Excluir"
                        className="btn btn-ghost h-7 w-7 !px-0 text-[var(--color-danger)]"
                        onClick={async () => {
                          await repo.patients.deleteNote(scope, note.id);
                          load();
                        }}
                      >
                        <IconX width={13} height={13} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

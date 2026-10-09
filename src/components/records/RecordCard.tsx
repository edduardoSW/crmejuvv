"use client";

import { Avatar } from "@/components/ui/Avatar";
import { date, time } from "@/lib/format";
import type { ClinicalRecordMeta, Patient, Profile } from "@/lib/domain/types";
import { IconCheck, IconLock, IconRecord } from "@/components/icons";

export function RecordCard({
  record,
  patient,
  author,
  isMine,
  onOpen,
}: {
  record: ClinicalRecordMeta;
  patient?: Patient;
  author?: Profile;
  isMine: boolean;
  onOpen: () => void;
}) {
  const name = patient
    ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
    : "Paciente";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card group flex w-full flex-col gap-3.5 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={patient?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{name}</p>
          {author && !isMine && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
              {author.full_name}
            </p>
          )}
        </div>
        {!isMine && (
          <span
            className="icon-chip h-8 w-8"
            style={{
              background: "var(--color-surface-2)",
              color: "var(--color-ink-subtle)",
            }}
            title="Evolução de outra profissional"
          >
            <IconLock width={15} height={15} />
          </span>
        )}
      </div>

      {/* Prévia intencionalmente ausente: o card lista metadados, nunca o texto
          da evolução, mesmo para a responsável, o conteúdo só abre no modal. */}
      <div className="flex items-center gap-2 rounded-[12px] bg-[var(--color-surface-2)] px-3 py-2.5">
        <IconRecord width={15} height={15} className="shrink-0 text-[var(--color-ink-subtle)]" />
        <span className="text-xs text-[var(--color-ink-muted)]">
          {isMine
            ? "Abrir para ler e editar"
            : "Evolução de outra profissional"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-3">
        <span className="tabular font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
          {date(record.created_at)} · {time(record.created_at)}
        </span>
        {record.signed_at ? (
          <span
            className="badge"
            style={{
              background: "var(--color-success-soft)",
              color: "var(--color-success)",
            }}
          >
            <IconCheck width={11} height={11} />
            Assinada
          </span>
        ) : (
          <span
            className="badge"
            style={{
              background: "var(--color-warn-soft)",
              color: "var(--color-warn)",
            }}
          >
            Rascunho
          </span>
        )}
      </div>
    </button>
  );
}

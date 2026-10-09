"use client";

import { Avatar } from "@/components/ui/Avatar";
import { EntryBadge } from "@/components/ui/Status";
import { brl, date } from "@/lib/format";
import type { FinancialEntry, Patient, Profile } from "@/lib/domain/types";

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

export function EntryCard({
  entry,
  patient,
  professional,
  planName,
  onReceive,
  onGlosa,
  onEdit,
  onDelete,
}: {
  entry: FinancialEntry;
  patient?: Patient;
  professional?: Profile;
  planName: string;
  onReceive: () => void;
  onGlosa: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = patient
    ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
    : "Paciente";

  return (
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={name} src={patient?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{name}</p>
          {professional && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
              {professional.full_name}
            </p>
          )}
        </div>
        <EntryBadge status={entry.status} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="overline">Valor</p>
          <p className="tabular mt-1 font-[family-name:var(--font-mono)] text-xl leading-none">
            {brl(entry.gross_amount)}
          </p>
        </div>
        <span
          className="badge"
          style={
            entry.origin === "convenio"
              ? { background: "var(--color-info-soft)", color: "var(--color-info)" }
              : { background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }
          }
        >
          {entry.origin === "convenio" ? planName : "Particular"}
        </span>
      </div>

      {entry.glosa_reason && (
        <p className="rounded-[10px] bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {entry.glosa_reason}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-3">
        <span className="tabular font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
          {date(entry.created_at)}
          {entry.payment_method && ` · ${METHOD_LABELS[entry.payment_method] ?? entry.payment_method}`}
        </span>

        <div className="flex gap-1">
          {entry.status !== "recebido" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onReceive}>
              Receber
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
            Editar
          </button>
          <button
            type="button"
            aria-label="Excluir lançamento"
            className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-danger)]"
            onClick={onDelete}
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}

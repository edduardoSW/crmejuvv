/**
 * Badge de status. Cada status tem UMA cor, usada em todo o sistema
 * (docs/05-design-system.md §4.1). Status nunca é comunicado só por cor —
 * sempre cor + texto.
 */

import {
  APPOINTMENT_STATUS_LABELS,
  ENTRY_STATUS_LABELS,
  type AppointmentStatus,
  type EntryStatus,
} from "@/lib/domain/types";

const APPOINTMENT_TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  confirmed: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  attended: "bg-[var(--color-success)] text-white",
  no_show: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  cancelled: "bg-[var(--color-surface-2)] text-[var(--color-ink-subtle)]",
};

const ENTRY_TONE: Record<EntryStatus, string> = {
  previsto: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  faturado: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  recebido: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  glosado: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`badge ${APPOINTMENT_TONE[status]}`}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function EntryBadge({ status }: { status: EntryStatus }) {
  return (
    <span className={`badge ${ENTRY_TONE[status]}`}>
      {ENTRY_STATUS_LABELS[status]}
    </span>
  );
}

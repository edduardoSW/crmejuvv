"use client";

import { Avatar } from "@/components/ui/Avatar";
import { date } from "@/lib/format";
import type { Patient, Profile } from "@/lib/domain/types";
import { IconAlert, IconCalendar, IconRecord } from "@/components/icons";

export function PatientCard({
  patient,
  owner,
  planName,
  nextSession,
  sessionCount,
  noteCount,
  onOpen,
}: {
  patient: Patient;
  owner?: Profile;
  planName: string;
  nextSession?: string | null;
  sessionCount: number;
  noteCount: number;
  onOpen: () => void;
}) {
  const name = `${patient.first_name} ${patient.last_name ?? ""}`.trim();
  const alert = patient.no_show_count >= 3;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card group flex w-full flex-col gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={name} src={patient.avatar_url} size="lg" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
            {patient.phone}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="badge"
              style={
                patient.payment_type === "convenio"
                  ? { background: "var(--color-info-soft)", color: "var(--color-info)" }
                  : { background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }
              }
            >
              {patient.payment_type === "convenio" ? planName : "Particular"}
            </span>
            {patient.status === "inactive" && (
              <span
                className="badge"
                style={{ background: "var(--color-surface-2)", color: "var(--color-ink-subtle)" }}
              >
                Inativo
              </span>
            )}
            {alert && (
              <span
                className="badge"
                style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
              >
                {patient.no_show_count} faltas
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-[var(--color-line)] pt-3.5">
        <Stat
          icon={<IconCalendar width={13} height={13} />}
          label="Sessões"
          value={String(sessionCount)}
        />
        <Stat
          icon={<IconRecord width={13} height={13} />}
          label="Anotações"
          value={String(noteCount)}
        />
        <Stat
          icon={<IconAlert width={13} height={13} />}
          label="Próxima"
          value={nextSession ? date(nextSession) : "—"}
        />
      </dl>

      <p className="truncate text-xs text-[var(--color-ink-subtle)]">
        Paciente desde {date(patient.created_at)}
      </p>
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">
        <span aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="tabular mt-1 truncate font-[family-name:var(--font-mono)] text-sm">
        {value}
      </dd>
    </div>
  );
}

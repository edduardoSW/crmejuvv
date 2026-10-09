"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor, isRepoError, type Conflict } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { AppointmentBadge } from "@/components/ui/Status";
import { initials, time } from "@/lib/format";
import {
  APPOINTMENT_TYPE_LABELS,
  type Appointment,
  type AppointmentStatus,
  type AppointmentType,
  type Patient,
  type Profile,
  type Room,
  type Service,
} from "@/lib/domain/types";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconPlus,
  IconSend,
} from "@/components/icons";

const TODAY = new Date(2026, 7, 17);
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8h–18h

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7)); // segunda
  out.setHours(0, 0, 0, 0);
  return out;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function AgendaPage() {
  const { scope, revision, isSolo } = useApp();
  const params = useSearchParams();

  const [view, setView] = useState<"dia" | "semana">("semana");

  // No celular a grade semanal fica ilegível: abre no dia.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("dia");
  }, []);
  const [cursor, setCursor] = useState(TODAY);
  const [items, setItems] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filterPro, setFilterPro] = useState("");
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(params.get("nova") === "1");
  const [slot, setSlot] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (view === "dia") {
      const from = new Date(cursor); from.setHours(0, 0, 0, 0);
      const to = new Date(cursor); to.setHours(23, 59, 59, 999);
      return { from, to, days: [new Date(from)] };
    }
    const from = startOfWeek(cursor);
    const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(from); d.setDate(d.getDate() + i); return d;
    });
    return { from, to, days };
  }, [view, cursor]);

  const load = useCallback(async () => {
    if (!scope) return;
    const [appts, pros, pats, svc, rms] = await Promise.all([
      repo.appointments.list(scope, {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        professional_ids: filterPro ? [filterPro] : undefined,
      }),
      repo.team.listProfessionals(scope),
      repo.patients.list(scope, { per_page: 500 }),
      repo.settings.services(scope),
      repo.settings.rooms(scope),
    ]);
    setItems(appts);
    setProfessionals(pros);
    setPatients(pats.items);
    setServices(svc);
    setRooms(rms);
  }, [scope, range.from, range.to, filterPro]);

  useEffect(() => { load(); }, [load, revision]);

  const patientName = useCallback(
    (id: string) => {
      const p = patients.find((x) => x.id === id);
      return p ? `${p.first_name} ${p.last_name ?? ""}`.trim() : "Paciente";
    },
    [patients],
  );

  if (!scope) return null;

  const counters = {
    total: items.length,
    confirmadas: items.filter((a) => a.status === "confirmed").length,
    faltas: items.filter((a) => a.status === "no_show").length,
    semLembrete: items.filter((a) => !a.reminder_sent_at && a.status === "scheduled").length,
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline overline-gold">Atendimento</p>
          <h1 className="mt-3">Agenda</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
            {counters.total} sessões no período · {counters.confirmadas} confirmadas
            {counters.semLembrete > 0 && ` · ${counters.semLembrete} sem lembrete`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => { setSlot(null); setCreating(true); }}
        >
          <IconPlus width={16} height={16} />
          Nova sessão
        </button>
      </header>

      {/* --------------------------------------------------- controles */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="segmented">
          {(["dia", "semana"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                view === v
                  ? "bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              {v === "dia" ? "Dia" : "Semana"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Período anterior"
            className="btn btn-ghost h-9 w-9 !px-0"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() - (view === "dia" ? 1 : 7));
              setCursor(d);
            }}
          >
            ‹
          </button>
          <span className="min-w-[120px] flex-1 text-center text-sm font-medium sm:min-w-[190px] sm:flex-none">
            {view === "dia" ? (
              <>
                <span className="hidden sm:inline">
                  {cursor.toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long",
                  })}
                </span>
                <span className="sm:hidden">
                  {cursor.toLocaleDateString("pt-BR", {
                    weekday: "short", day: "2-digit", month: "short",
                  })}
                </span>
              </>
            ) : (
              `${range.days[0]!.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${range.days[range.days.length - 1]!.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
            )}
          </span>
          <button
            type="button"
            aria-label="Próximo período"
            className="btn btn-ghost h-9 w-9 !px-0"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() + (view === "dia" ? 1 : 7));
              setCursor(d);
            }}
          >
            ›
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setCursor(TODAY)}
          >
            Hoje
          </button>
        </div>

        {!isSolo && scope.allowed_professional_ids === null && (
          <Select
            label="Filtrar por profissional"
            size="sm"
            className="ml-auto w-[200px]"
            value={filterPro}
            onChange={setFilterPro}
            options={[
              { value: "", label: "Todas as profissionais" },
              ...professionals.map((p) => ({ value: p.id, label: p.full_name })),
            ]}
          />
        )}
      </div>

      {/* ------------------------------------------------------- grade */}
      <div className="card overflow-hidden">
        <div className="scroll-x">
          {/* Só a semana força largura mínima; o dia cabe em qualquer tela. */}
          <div className={view === "semana" ? "min-w-[720px]" : ""}>
            <div
              className="grid border-b border-[var(--color-line)]"
              style={{ gridTemplateColumns: `64px repeat(${range.days.length}, 1fr)` }}
            >
              <div />
              {range.days.map((d) => {
                const isToday = d.toDateString() === TODAY.toDateString();
                return (
                  <div key={d.toISOString()} className="px-2 py-3 text-center">
                    <p className="overline">{WEEKDAYS[(d.getDay() + 6) % 7]}</p>
                    <p
                      className={`tabular mt-1 font-[family-name:var(--font-mono)] text-sm ${
                        isToday ? "text-[var(--color-accent)]" : ""
                      }`}
                    >
                      {d.getDate().toString().padStart(2, "0")}/
                      {(d.getMonth() + 1).toString().padStart(2, "0")}
                    </p>
                  </div>
                );
              })}
            </div>

            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-[var(--color-line)] last:border-0"
                style={{ gridTemplateColumns: `64px repeat(${range.days.length}, 1fr)` }}
              >
                <div className="border-r border-[var(--color-line)] px-2 py-2">
                  <span className="overline">{hour}h</span>
                </div>
                {range.days.map((day) => {
                  const cell = items.filter((a) => {
                    const d = new Date(a.starts_at);
                    return (
                      d.toDateString() === day.toDateString() &&
                      d.getHours() === hour
                    );
                  });
                  return (
                    <button
                      key={`${day.toISOString()}-${hour}`}
                      type="button"
                      onClick={() => {
                        if (cell.length) return;
                        const s = new Date(day);
                        s.setHours(hour, 0, 0, 0);
                        setSlot(s);
                        setCreating(true);
                      }}
                      className="min-h-[58px] space-y-1 border-r border-[var(--color-line)] p-1 text-left last:border-0 hover:bg-[var(--color-surface-2)]"
                    >
                      {cell.map((a) => (
                        <span
                          key={a.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setDetail(a); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.stopPropagation(); setDetail(a); }
                          }}
                          className="block truncate rounded-[8px] px-2 py-1.5 text-xs transition-all hover:brightness-95"
                          style={{
                            background:
                              a.status === "cancelled"
                                ? "var(--color-surface-2)"
                                : a.status === "no_show"
                                  ? "var(--color-danger-soft)"
                                  : a.status === "attended"
                                    ? "var(--color-success-soft)"
                                    : "var(--color-accent-soft)",
                            color:
                              a.status === "cancelled"
                                ? "var(--color-ink-subtle)"
                                : a.status === "no_show"
                                  ? "var(--color-danger)"
                                  : a.status === "attended"
                                    ? "var(--color-success)"
                                    : "var(--color-accent-ink)",
                            textDecoration:
                              a.status === "cancelled" ? "line-through" : undefined,
                          }}
                        >
                          <span className="tabular font-[family-name:var(--font-mono)]">
                            {time(a.starts_at)}
                          </span>{" "}
                          {patientName(a.patient_id)}
                          {a.is_overbook && " ⚡"}
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AppointmentDetail
        appointment={detail}
        onClose={() => setDetail(null)}
        patientName={patientName}
        professionals={professionals}
        rooms={rooms}
        onChanged={() => { setDetail(null); load(); }}
      />

      <NewAppointmentModal
        open={creating}
        onClose={() => setCreating(false)}
        initialSlot={slot}
        patients={patients}
        professionals={professionals}
        services={services}
        rooms={rooms}
        onCreated={() => { setCreating(false); load(); }}
      />
    </div>
  );
}

/* --------------------------------------------------- detalhe da sessão */

function AppointmentDetail({
  appointment, onClose, patientName, professionals, rooms, onChanged,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  patientName: (id: string) => string;
  professionals: Profile[];
  rooms: Room[];
  onChanged: () => void;
}) {
  const { scope } = useApp();
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!appointment || !scope) return null;

  async function setStatus(status: AppointmentStatus) {
    if (!scope || !appointment) return;
    try {
      await repo.appointments.setStatus(scope, appointment.id, status);
      onChanged();
    } catch (e) { setError(messageFor(e)); }
  }

  async function sendReminder() {
    if (!scope || !appointment) return;
    await repo.appointments.markReminderSent(scope, appointment.id);
    onChanged();
  }

  async function doCancel() {
    if (!scope || !appointment) return;
    try {
      await repo.appointments.cancel(scope, appointment.id, cancelReason);
      onChanged();
    } catch (e) { setError(messageFor(e)); }
  }

  const pro = professionals.find((p) => p.id === appointment.professional_id);
  const room = rooms.find((r) => r.id === appointment.room_id);

  return (
    <Modal
      open
      onClose={onClose}
      title={patientName(appointment.patient_id)}
      description={`${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${new Date(appointment.starts_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}, ${time(appointment.starts_at)}`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentBadge status={appointment.status} />
          {appointment.is_overbook && (
            <span
              className="badge"
              style={{ background: "var(--color-warn-soft)", color: "var(--color-warn)" }}
            >
              Encaixe
            </span>
          )}
          {appointment.reminder_sent_at ? (
            <span
              className="badge"
              style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}
            >
              Lembrete enviado
            </span>
          ) : (
            <span
              className="badge"
              style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}
            >
              Sem lembrete
            </span>
          )}
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div><dt className="overline">Sala</dt><dd className="mt-1 text-sm">{room?.name ?? "—"}</dd></div>
          <div><dt className="overline">Início</dt><dd className="tabular mt-1 text-sm">{time(appointment.starts_at)}</dd></div>
          <div><dt className="overline">Término</dt><dd className="tabular mt-1 text-sm">{time(appointment.ends_at)}</dd></div>
          {appointment.cancel_reason && (
            <div className="sm:col-span-2">
              <dt className="overline">Motivo do cancelamento</dt>
              <dd className="mt-1 text-sm">{appointment.cancel_reason}</dd>
            </div>
          )}
        </dl>

        {!appointment.reminder_sent_at && appointment.status !== "cancelled" && (
          <div className="rounded-[14px] bg-[var(--color-surface-2)] p-4">
            <p className="overline">Lembrete ao paciente</p>
            <p className="mt-2 rounded-[10px] bg-[var(--color-surface)] p-3 text-sm italic">
              &quot;Olá! Lembrando da sua sessão em{" "}
              {new Date(appointment.starts_at).toLocaleDateString("pt-BR")} às{" "}
              {time(appointment.starts_at)}. Podemos confirmar?&quot;
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn btn-outline btn-sm" onClick={sendReminder}>
                <IconSend width={15} height={15} />
                Marcar como enviado
              </button>
              <span className="text-xs text-[var(--color-ink-subtle)]">
                Simulado: nada é enviado nesta versão
              </span>
            </div>
          </div>
        )}

        {appointment.status !== "cancelled" && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-4">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus("attended")}>
              <IconCheck width={15} height={15} /> Marcar atendida
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setStatus("confirmed")}>
              Confirmar
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setStatus("no_show")}>
              Registrar falta
            </button>
            <button
              type="button"
              className="btn btn-sm ml-auto"
              style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
              onClick={() => setCancelling(true)}
            >
              Cancelar sessão
            </button>
          </div>
        )}

        {cancelling && (
          <div className="rounded-[14px] border border-[var(--color-line)] p-4">
            <label className="label" htmlFor="cmotivo">Motivo do cancelamento</label>
            <textarea
              id="cmotivo"
              rows={2}
              className="field"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm mt-3"
              disabled={!cancelReason.trim()}
              onClick={doCancel}
            >
              Confirmar cancelamento
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------- criação de sessão */

function NewAppointmentModal({
  open, onClose, initialSlot, patients, professionals, services, rooms, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialSlot: Date | null;
  patients: Patient[];
  professionals: Profile[];
  services: Service[];
  rooms: Room[];
  onCreated: () => void;
}) {
  const { scope } = useApp();
  const [form, setForm] = useState({
    patient_id: "", professional_id: "", service_id: "", room_id: "",
    date: "", hour: "09:00", type: "sessao" as AppointmentType,
  });
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = initialSlot ?? TODAY;
    setForm((f) => ({
      ...f,
      patient_id: f.patient_id || patients[0]?.id || "",
      professional_id: f.professional_id || professionals[0]?.id || "",
      service_id: f.service_id || services[0]?.id || "",
      room_id: f.room_id || rooms[0]?.id || "",
      date: base.toISOString().slice(0, 10),
      hour: initialSlot
        ? `${initialSlot.getHours().toString().padStart(2, "0")}:00`
        : f.hour,
    }));
    setConflicts([]);
    setError(null);
  }, [open, initialSlot, patients, professionals, services, rooms]);

  async function submit() {
    if (!scope) return;
    setBusy(true);
    setError(null);
    setConflicts([]);

    const service = services.find((s) => s.id === form.service_id);
    const starts = new Date(`${form.date}T${form.hour}:00`);
    const ends = new Date(starts.getTime() + (service?.duration_minutes ?? 50) * 60000);

    try {
      await repo.appointments.create(scope, {
        patient_id: form.patient_id,
        professional_id: form.professional_id,
        service_id: form.service_id,
        room_id: form.room_id || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        type: form.type,
      });
      onCreated();
    } catch (e) {
      if (isRepoError(e) && e.code === "conflict") {
        setConflicts((e.detail?.conflicts as Conflict[]) ?? []);
      } else {
        setError(messageFor(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function forceOverbook() {
    if (!scope) return;
    const service = services.find((s) => s.id === form.service_id);
    const starts = new Date(`${form.date}T${form.hour}:00`);
    const ends = new Date(starts.getTime() + (service?.duration_minutes ?? 50) * 60000);
    await repo.appointments.create(scope, {
      patient_id: form.patient_id,
      professional_id: form.professional_id,
      service_id: form.service_id,
      room_id: form.room_id || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      type: form.type,
      is_overbook: true,
    });
    onCreated();
  }

  const KIND_LABEL: Record<Conflict["kind"], string> = {
    professional: "Já existe sessão marcada neste horário",
    room: "A sala já está ocupada neste horário",
    patient: "O paciente já tem sessão neste horário",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova sessão"
      description="O sistema recusa horários já ocupados."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={busy || !form.patient_id || !form.professional_id}
          >
            {busy ? "Agendando…" : "Agendar"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="label">Paciente</span>
          <Select
            label="Paciente"
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.first_name} ${p.last_name ?? ""}`.trim(),
              hint: p.phone,
            }))}
          />
        </div>

        {professionals.length > 1 && (
          <div>
            <span className="label">Profissional</span>
            <Select
              label="Profissional"
              value={form.professional_id}
              onChange={(v) => setForm({ ...form, professional_id: v })}
              options={professionals.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </div>
        )}

        <div>
          <span className="label">Tipo</span>
          <Select
            label="Tipo de atendimento"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as AppointmentType })}
            options={Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => ({
              value: k,
              label: v,
            }))}
          />
        </div>

        <div>
          <label className="label" htmlFor="adata">Data</label>
          <input
            id="adata"
            type="date"
            className="field"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="ahora">Horário</label>
          <input
            id="ahora"
            type="time"
            step={1800}
            className="field"
            value={form.hour}
            onChange={(e) => setForm({ ...form, hour: e.target.value })}
          />
        </div>

        <div>
          <span className="label">Serviço</span>
          <Select
            label="Serviço"
            value={form.service_id}
            onChange={(v) => setForm({ ...form, service_id: v })}
            options={services.map((s) => ({
              value: s.id,
              label: s.name,
              hint: `${s.duration_minutes} min`,
            }))}
          />
        </div>

        <div>
          <span className="label">Sala</span>
          <Select
            label="Sala"
            value={form.room_id}
            onChange={(v) => setForm({ ...form, room_id: v })}
            options={[
              { value: "", label: "Sem sala" },
              ...rooms.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </div>

        {conflicts.length > 0 && (
          <div className="sm:col-span-2 rounded-[14px] bg-[var(--color-danger-soft)] p-4">
            <div className="flex gap-2.5">
              <IconAlert
                width={18} height={18}
                style={{ color: "var(--color-danger)" }}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
                  Horário indisponível
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {conflicts.map((c) => (
                    <li key={c.appointment_id}>
                      <strong>{KIND_LABEL[c.kind]}</strong>: {c.label}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-outline btn-sm mt-3"
                  onClick={forceOverbook}
                >
                  Agendar como encaixe mesmo assim
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="sm:col-span-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

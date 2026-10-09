/**
 * Agenda.
 *
 * Invariante (docs/03-modelo-de-dados.md §2.4): não podem existir duas sessões
 * sobrepostas na mesma organização com a mesma profissional, a mesma sala ou o
 * mesmo paciente. Na fase 2 isso vira EXCLUDE USING gist; aqui é validado no
 * repositório — e a mensagem precisa dizer QUAL dos três conflitou (CA-01).
 */

import { RepoError } from "../errors";
import type { Conflict } from "../contract";
import {
  db, tx, inOrg, newId, nowIso, overlaps, requireFound,
} from "./helpers";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  IsoDateTime,
  Scope,
  Uuid,
} from "@/lib/domain/types";

export interface AppointmentInput {
  patient_id: Uuid;
  professional_id: Uuid;
  service_id: Uuid;
  room_id: Uuid | null;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  type: AppointmentType;
  is_overbook?: boolean;
}

function label(data: ReturnType<typeof db>, a: Appointment): string {
  const professional = data.profiles.find((p) => p.id === a.professional_id);
  const time = new Date(a.starts_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${professional?.full_name ?? "Profissional"} às ${time}`;
}

function findConflicts(
  scope: Scope,
  input: AppointmentInput,
  ignoreId?: Uuid,
): Conflict[] {
  const data = db();
  const candidates = inOrg(data.appointments, scope).filter(
    (a) =>
      a.status !== "cancelled" &&
      a.id !== ignoreId &&
      overlaps(input.starts_at, input.ends_at, a.starts_at, a.ends_at),
  );

  const conflicts: Conflict[] = [];
  for (const a of candidates) {
    let kind: Conflict["kind"] | null = null;
    if (a.professional_id === input.professional_id) kind = "professional";
    else if (input.room_id && a.room_id === input.room_id) kind = "room";
    else if (a.patient_id === input.patient_id) kind = "patient";
    if (!kind) continue;

    conflicts.push({
      kind,
      appointment_id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      label:
        kind === "room"
          ? `${data.rooms.find((r) => r.id === a.room_id)?.name ?? "Sala"} ocupada às ${new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : label(data, a),
    });
  }
  return conflicts;
}

export const appointments = {
  async list(
    scope: Scope,
    params: {
      from: IsoDateTime;
      to: IsoDateTime;
      professional_ids?: Uuid[];
      room_id?: Uuid;
      patient_id?: Uuid;
      status?: AppointmentStatus[];
    },
  ): Promise<Appointment[]> {
    let rows = inOrg(db().appointments, scope).filter((a) =>
      overlaps(params.from, params.to, a.starts_at, a.ends_at),
    );

    // Escopo: a psicóloga só vê a própria agenda.
    if (scope.allowed_professional_ids !== null) {
      const allowed = new Set(scope.allowed_professional_ids);
      rows = rows.filter((a) => allowed.has(a.professional_id));
    }
    if (params.professional_ids?.length) {
      const filter = new Set(params.professional_ids);
      rows = rows.filter((a) => filter.has(a.professional_id));
    }
    if (params.room_id) rows = rows.filter((a) => a.room_id === params.room_id);
    if (params.patient_id) rows = rows.filter((a) => a.patient_id === params.patient_id);
    if (params.status?.length) {
      const filter = new Set(params.status);
      rows = rows.filter((a) => filter.has(a.status));
    }

    return rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  },

  async get(scope: Scope, id: Uuid): Promise<Appointment> {
    return requireFound(inOrg(db().appointments, scope).find((a) => a.id === id));
  },

  async checkConflicts(
    scope: Scope,
    input: AppointmentInput,
    ignoreId?: Uuid,
  ): Promise<Conflict[]> {
    return findConflicts(scope, input, ignoreId);
  },

  async create(scope: Scope, input: AppointmentInput): Promise<Appointment> {
    const conflicts = findConflicts(scope, input);
    if (conflicts.length && !input.is_overbook) {
      throw new RepoError("conflict", { conflicts });
    }

    return tx((data) => {
      const appointment: Appointment = {
        id: newId("appt"),
        org_id: scope.org_id,
        patient_id: input.patient_id,
        professional_id: input.professional_id,
        service_id: input.service_id,
        room_id: input.room_id,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        status: "scheduled",
        type: input.type,
        is_overbook: input.is_overbook ?? false,
        rescheduled_from: null,
        cancel_reason: null,
        reminder_sent_at: null,
        recurrence_group_id: null,
        created_by: scope.profile_id,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.appointments.push(appointment);
      return appointment;
    });
  },

  async reschedule(
    scope: Scope,
    id: Uuid,
    starts_at: IsoDateTime,
    room_id?: Uuid | null,
  ): Promise<Appointment> {
    const current = await appointments.get(scope, id);
    const duration =
      new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime();
    const ends_at = new Date(new Date(starts_at).getTime() + duration).toISOString();

    const conflicts = findConflicts(
      scope,
      { ...current, starts_at, ends_at, room_id: room_id ?? current.room_id },
      id,
    );
    if (conflicts.length) throw new RepoError("conflict", { conflicts });

    return tx((data) => {
      const row = requireFound(data.appointments.find((a) => a.id === id));
      // Preserva o histórico da remarcação (RF-02.4).
      row.rescheduled_from = row.starts_at;
      row.starts_at = starts_at;
      row.ends_at = ends_at;
      if (room_id !== undefined) row.room_id = room_id;
      row.reminder_sent_at = null; // lembrete volta a pendente
      row.updated_at = nowIso();
      return { ...row };
    });
  },

  async cancel(scope: Scope, id: Uuid, reason: string): Promise<Appointment> {
    if (!reason.trim()) throw new RepoError("validation", { field: "reason" });
    return tx((data) => {
      const row = requireFound(
        data.appointments.find((a) => a.id === id && a.org_id === scope.org_id),
      );
      row.status = "cancelled";
      row.cancel_reason = reason.trim();
      row.updated_at = nowIso();
      return { ...row };
    });
  },

  /**
   * Marcar como atendida gera o lançamento financeiro (RF-05.1).
   * Efeito colateral documentado, dentro do repositório, para que protótipo e
   * backend se comportem igual.
   */
  async setStatus(
    scope: Scope,
    id: Uuid,
    status: AppointmentStatus,
  ): Promise<Appointment> {
    return tx((data) => {
      const row = requireFound(
        data.appointments.find((a) => a.id === id && a.org_id === scope.org_id),
      );
      const previous = row.status;
      row.status = status;
      row.updated_at = nowIso();

      if (status === "no_show" && previous !== "no_show") {
        const patient = data.patients.find((p) => p.id === row.patient_id);
        if (patient) patient.no_show_count += 1;
      }

      const alreadyBilled = data.financial_entries.some(
        (e) => e.appointment_id === row.id,
      );
      if ((status === "attended" || status === "no_show") && !alreadyBilled) {
        const patient = data.patients.find((p) => p.id === row.patient_id);
        if (patient) {
          const price = data.service_prices.find(
            (sp) =>
              sp.org_id === scope.org_id &&
              sp.service_id === row.service_id &&
              sp.health_plan_id === patient.health_plan_id,
          );
          const amount = price?.price ?? 0;
          data.financial_entries.push({
            id: newId("finc"),
            org_id: scope.org_id,
            appointment_id: row.id,
            patient_id: patient.id,
            professional_id: row.professional_id,
            origin: patient.payment_type,
            health_plan_id: patient.health_plan_id,
            gross_amount: status === "no_show" ? amount * 0.5 : amount,
            status: "previsto",
            billing_batch_id: null,
            due_date: null,
            paid_at: null,
            payment_method: null,
            glosa_reason: null,
            tiss_guide_number: null,
            created_at: nowIso(),
          });
        }
      }

      return { ...row };
    });
  },

  /** Lembrete SIMULADO: marca como enviado; nada sai do navegador. */
  async markReminderSent(scope: Scope, id: Uuid): Promise<Appointment> {
    return tx((data) => {
      const row = requireFound(
        data.appointments.find((a) => a.id === id && a.org_id === scope.org_id),
      );
      row.reminder_sent_at = nowIso();
      row.updated_at = nowIso();
      return { ...row };
    });
  },

  /**
   * Horários livres da profissional no dia — grade padrão menos bloqueios e
   * sessões existentes. É o que faz remarcar caber em três telas (JTBD 1).
   */
  async availability(
    scope: Scope,
    params: { professional_id: Uuid; date: string; service_id: Uuid },
  ): Promise<{ starts_at: string; ends_at: string }[]> {
    const data = db();
    const day = new Date(`${params.date}T00:00:00`);
    const weekday = day.getDay();

    const schedules = data.professional_schedules.filter(
      (s) =>
        s.org_id === scope.org_id &&
        s.professional_id === params.professional_id &&
        s.weekday === weekday,
    );
    if (!schedules.length) return [];

    const service = data.services.find((s) => s.id === params.service_id);
    const duration = service?.duration_minutes ?? 50;

    const busy = inOrg(data.appointments, scope).filter(
      (a) =>
        a.professional_id === params.professional_id &&
        a.status !== "cancelled" &&
        a.starts_at.startsWith(params.date),
    );
    const blocks = data.schedule_blocks.filter(
      (b) =>
        b.org_id === scope.org_id &&
        b.professional_id === params.professional_id &&
        b.starts_at.startsWith(params.date),
    );

    const slots: { starts_at: string; ends_at: string }[] = [];
    for (const schedule of schedules) {
      const [sh = 8, sm = 0] = schedule.start_time.split(":").map(Number);
      const [eh = 18, em = 0] = schedule.end_time.split(":").map(Number);
      const cursor = new Date(day);
      cursor.setHours(sh, sm, 0, 0);
      const limit = new Date(day);
      limit.setHours(eh, em, 0, 0);

      while (cursor.getTime() + duration * 60_000 <= limit.getTime()) {
        const start = new Date(cursor).toISOString();
        const end = new Date(cursor.getTime() + duration * 60_000).toISOString();
        const taken =
          busy.some((a) => overlaps(start, end, a.starts_at, a.ends_at)) ||
          blocks.some((b) => overlaps(start, end, b.starts_at, b.ends_at));
        if (!taken) slots.push({ starts_at: start, ends_at: end });
        cursor.setMinutes(cursor.getMinutes() + duration);
      }
    }
    return slots;
  },
};

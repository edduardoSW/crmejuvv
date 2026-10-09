/**
 * Relatórios. Todo indicador tem recorte por profissional E consolidado (RF-06.5).
 * Nenhum deles expõe conteúdo clínico — só contagem, valor e presença.
 */

import { RepoError } from "../errors";
import { db, inOrg } from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type { Scope, Uuid } from "@/lib/domain/types";

export interface Period {
  from: string;
  to: string;
}

export interface Overview {
  attendances: number;
  attendances_delta: number;
  revenue: number;
  revenue_delta: number;
  no_show_rate: number;
  no_show_delta: number;
  occupancy: number;
  active_patients: number;
}

export interface ProfessionalStats {
  professional_id: Uuid;
  name: string;
  scheduled: number;
  attended: number;
  no_show: number;
  cancelled: number;
  no_show_rate: number;
  revenue: number;
  occupancy: number;
}

function previousPeriod(period: Period): Period {
  const from = new Date(period.from).getTime();
  const to = new Date(period.to).getTime();
  const span = to - from;
  return {
    from: new Date(from - span).toISOString(),
    to: new Date(from).toISOString(),
  };
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function scopedAppointments(scope: Scope, period: Period) {
  let rows = inOrg(db().appointments, scope).filter(
    (a) => a.starts_at >= period.from && a.starts_at <= period.to,
  );
  if (scope.allowed_professional_ids !== null) {
    const allowed = new Set(scope.allowed_professional_ids);
    rows = rows.filter((a) => allowed.has(a.professional_id));
  }
  return rows;
}

function scopedEntries(scope: Scope, period: Period) {
  let rows = inOrg(db().financial_entries, scope).filter(
    (e) => e.created_at >= period.from && e.created_at <= period.to,
  );
  if (!hasPermission(scope, "finance.read.all")) {
    rows = rows.filter((e) => e.professional_id === scope.profile_id);
  }
  return rows;
}

/** Capacidade teórica: grade padrão × semanas do período. */
function capacity(scope: Scope, period: Period, professionalId?: Uuid): number {
  const data = db();
  let schedules = data.professional_schedules.filter(
    (s) => s.org_id === scope.org_id,
  );
  if (professionalId) {
    schedules = schedules.filter((s) => s.professional_id === professionalId);
  } else if (scope.allowed_professional_ids !== null) {
    const allowed = new Set(scope.allowed_professional_ids);
    schedules = schedules.filter((s) => allowed.has(s.professional_id));
  }

  const weeks =
    (new Date(period.to).getTime() - new Date(period.from).getTime()) /
    (7 * 24 * 3600 * 1000);

  const slotsPerWeek = schedules.reduce((sum, s) => {
    const [sh = 0, sm = 0] = s.start_time.split(":").map(Number);
    const [eh = 0, em = 0] = s.end_time.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return sum + Math.floor(minutes / 50);
  }, 0);

  return Math.max(1, Math.round(slotsPerWeek * weeks));
}

export const reports = {
  async overview(scope: Scope, period: Period): Promise<Overview> {
    const current = scopedAppointments(scope, period);
    const previous = scopedAppointments(scope, previousPeriod(period));

    const attended = current.filter((a) => a.status === "attended").length;
    const attendedPrev = previous.filter((a) => a.status === "attended").length;

    const finished = current.filter((a) =>
      ["attended", "no_show"].includes(a.status),
    );
    const noShows = current.filter((a) => a.status === "no_show").length;
    const noShowRate = finished.length ? (noShows / finished.length) * 100 : 0;

    const finishedPrev = previous.filter((a) =>
      ["attended", "no_show"].includes(a.status),
    );
    const noShowsPrev = previous.filter((a) => a.status === "no_show").length;
    const noShowRatePrev = finishedPrev.length
      ? (noShowsPrev / finishedPrev.length) * 100
      : 0;

    const revenue = scopedEntries(scope, period)
      .filter((e) => e.status === "recebido")
      .reduce((sum, e) => sum + e.gross_amount, 0);
    const revenuePrev = scopedEntries(scope, previousPeriod(period))
      .filter((e) => e.status === "recebido")
      .reduce((sum, e) => sum + e.gross_amount, 0);

    let activePatients = inOrg(db().patients, scope).filter(
      (p) => p.status === "active",
    );
    if (scope.allowed_professional_ids !== null) {
      const allowed = new Set(scope.allowed_professional_ids);
      activePatients = activePatients.filter((p) => allowed.has(p.owner_id));
    }

    return {
      attendances: attended,
      attendances_delta: delta(attended, attendedPrev),
      revenue,
      revenue_delta: delta(revenue, revenuePrev),
      no_show_rate: noShowRate,
      no_show_delta: noShowRate - noShowRatePrev,
      occupancy: Math.min(100, (current.length / capacity(scope, period)) * 100),
      active_patients: activePatients.length,
    };
  },

  async byProfessional(
    scope: Scope,
    period: Period,
  ): Promise<ProfessionalStats[]> {
    if (!hasPermission(scope, "report.read.all")) throw new RepoError("forbidden");

    const data = db();
    const appointments = scopedAppointments(scope, period);
    const entries = scopedEntries(scope, period);

    const professionalIds = [
      ...new Set(
        data.memberships
          .filter((m) => m.org_id === scope.org_id && m.status === "active")
          .filter((m) => m.role !== "reception")
          .map((m) => m.profile_id),
      ),
    ];

    return professionalIds
      .map((id) => {
        const own = appointments.filter((a) => a.professional_id === id);
        const attended = own.filter((a) => a.status === "attended").length;
        const noShow = own.filter((a) => a.status === "no_show").length;
        const cancelled = own.filter((a) => a.status === "cancelled").length;
        const finished = attended + noShow;

        return {
          professional_id: id,
          name: data.profiles.find((p) => p.id === id)?.full_name ?? "—",
          scheduled: own.length,
          attended,
          no_show: noShow,
          cancelled,
          no_show_rate: finished ? (noShow / finished) * 100 : 0,
          revenue: entries
            .filter((e) => e.professional_id === id && e.status === "recebido")
            .reduce((sum, e) => sum + e.gross_amount, 0),
          occupancy: Math.min(
            100,
            (own.length / capacity(scope, period, id)) * 100,
          ),
        };
      })
      .filter((s) => s.scheduled > 0)
      .sort((a, b) => b.attended - a.attended);
  },

  /** Série mensal de atendimentos e faltas, para o gráfico do dashboard. */
  async monthlySeries(
    scope: Scope,
    period: Period,
  ): Promise<{ month: string; attended: number; no_show: number; revenue: number }[]> {
    const appointments = scopedAppointments(scope, period);
    const entries = scopedEntries(scope, period);
    const buckets = new Map<
      string,
      { month: string; attended: number; no_show: number; revenue: number }
    >();

    const keyOf = (iso: string) => iso.slice(0, 7);

    for (const a of appointments) {
      const key = keyOf(a.starts_at);
      if (!buckets.has(key)) {
        buckets.set(key, { month: key, attended: 0, no_show: 0, revenue: 0 });
      }
      const bucket = buckets.get(key)!;
      if (a.status === "attended") bucket.attended += 1;
      if (a.status === "no_show") bucket.no_show += 1;
    }

    for (const e of entries.filter((x) => x.status === "recebido")) {
      const key = keyOf(e.created_at);
      if (!buckets.has(key)) {
        buckets.set(key, { month: key, attended: 0, no_show: 0, revenue: 0 });
      }
      buckets.get(key)!.revenue += e.gross_amount;
    }

    return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
  },
};

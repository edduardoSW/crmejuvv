/**
 * Auditoria.
 *
 * Leitura exclusiva de quem tem `audit.read` (a dona). É a única listagem que
 * a própria dona não pode filtrar para esconder as próprias ações — por isso
 * não existe parâmetro que exclua o próprio actor_id.
 */

import { RepoError } from "../errors";
import { paginate, type ListParams, type Page } from "../contract";
import { db, inOrg } from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type {
  AuditAction,
  AuditLog,
  RecordShare,
  Scope,
  Uuid,
} from "@/lib/domain/types";

export interface AuditView extends AuditLog {
  actor_name: string;
}

export const audit = {
  async list(
    scope: Scope,
    params?: ListParams & {
      actor_id?: Uuid;
      action?: AuditAction;
      entity?: string;
      from?: string;
      to?: string;
    },
  ): Promise<Page<AuditView>> {
    if (!hasPermission(scope, "audit.read")) throw new RepoError("forbidden");

    const data = db();
    let rows = inOrg(data.audit_logs, scope);

    if (params?.actor_id) rows = rows.filter((l) => l.actor_id === params.actor_id);
    if (params?.action) rows = rows.filter((l) => l.action === params.action);
    if (params?.entity) rows = rows.filter((l) => l.entity === params.entity);
    if (params?.from) rows = rows.filter((l) => l.created_at >= params.from!);
    if (params?.to) rows = rows.filter((l) => l.created_at <= params.to!);

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const views: AuditView[] = rows.map((log) => ({
      ...log,
      actor_name:
        data.profiles.find((p) => p.id === log.actor_id)?.full_name ?? "—",
    }));

    return paginate(views, params);
  },

  /** Compartilhamentos de evolução — quem deu acesso a quem. */
  async listShares(
    scope: Scope,
    params?: ListParams,
  ): Promise<Page<RecordShare & { by_name: string; with_name: string; patient_name: string }>> {
    if (!hasPermission(scope, "audit.read")) throw new RepoError("forbidden");

    const data = db();
    const rows = inOrg(data.record_shares, scope)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((share) => {
        const patient = data.patients.find((p) => p.id === share.patient_id);
        return {
          ...share,
          by_name:
            data.profiles.find((p) => p.id === share.shared_by)?.full_name ?? "—",
          with_name:
            data.profiles.find((p) => p.id === share.shared_with)?.full_name ?? "—",
          patient_name: patient
            ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
            : "—",
        };
      });

    return paginate(rows, params);
  },

  async notifications(scope: Scope) {
    return inOrg(db().notifications, scope)
      .filter((n) => n.profile_id === scope.profile_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
};

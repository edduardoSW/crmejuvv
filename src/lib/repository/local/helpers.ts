/**
 * Utilidades compartilhadas pela implementação local.
 * O filtro por escopo mora aqui — é a barreira que na fase 2 vira RLS.
 */

import { readDatabase, mutate, writeDatabase, type Database } from "../store";
import { RepoError } from "../errors";
import { buildSeed } from "@/lib/seed";
import type { AuditAction, Scope, Uuid } from "@/lib/domain/types";

/** Toda entidade do sistema tem org_id. */
interface OrgScoped {
  org_id: Uuid;
}

/**
 * Filtro obrigatório por organização.
 * Nenhuma leitura do sistema passa por fora daqui — é o que garante o RNF-03.
 */
export function inOrg<T extends OrgScoped>(rows: T[], scope: Scope): T[] {
  return rows.filter((r) => r.org_id === scope.org_id);
}

/**
 * Aplica a whitelist de profissionais visíveis.
 * `allowed_professional_ids === null` significa "toda a organização".
 */
export function inScope<T extends OrgScoped & { professional_id: Uuid }>(
  rows: T[],
  scope: Scope,
): T[] {
  const scoped = inOrg(rows, scope);
  if (scope.allowed_professional_ids === null) return scoped;
  const allowed = new Set(scope.allowed_professional_ids);
  return scoped.filter((r) => allowed.has(r.professional_id));
}

export function db(): Database {
  return readDatabase();
}

/**
 * (Re)popula a base com o seed determinístico.
 * Chamado na primeira carga e pelo botão "Restaurar dados de demonstração".
 */
/**
 * A cota do localStorage varia por navegador e é contada em UTF-16, então
 * nenhum tamanho fixo de seed é seguro. Em vez de adivinhar o teto, tentamos do
 * maior para o menor: se o navegador recusar, o seed encolhe o histórico e
 * tenta de novo. O usuário nunca vê a tela quebrada por causa disso.
 */
const SEED_ATTEMPTS = [26, 16, 10, 6];

export function resetToSeed(): Database {
  let lastError: unknown;

  for (const historyWeeks of SEED_ATTEMPTS) {
    const seeded = buildSeed({ historyWeeks });
    try {
      writeDatabase(seeded);
      return seeded;
    } catch (e) {
      lastError = e;
      if (!(e instanceof RepoError) || e.code !== "quota_exceeded") throw e;
      console.warn(
        `[seed] ${historyWeeks} semanas não couberam no armazenamento local, reduzindo`,
      );
    }
  }

  throw lastError;
}

/** Semeia apenas se a base estiver vazia. */
export function ensureSeeded(): Database {
  const current = readDatabase();
  if (current.organizations.length > 0) return current;
  return resetToSeed();
}

export function tx<T>(fn: (data: Database) => T): T {
  return mutate(fn);
}

let counter = Date.now();
export function newId(prefix: string): Uuid {
  counter += 1;
  const n = counter.toString(16).padStart(12, "0").slice(-12);
  return `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${n}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function requireFound<T>(row: T | undefined): T {
  if (!row) throw new RepoError("not_found");
  return row;
}

/** Registra na trilha de auditoria. Chamado de dentro do repositório, nunca da UI. */
export function writeAudit(
  data: Database,
  scope: Scope,
  action: AuditAction,
  entity: string,
  entity_id: Uuid,
  reason: string | null = null,
  metadata: Record<string, unknown> | null = null,
): void {
  data.audit_logs.push({
    id: newId("audt"),
    org_id: scope.org_id,
    actor_id: scope.profile_id,
    action,
    entity,
    entity_id,
    reason,
    metadata,
    created_at: nowIso(),
  });
}

export function notify(
  data: Database,
  scope: Scope,
  profile_id: Uuid,
  type: string,
  title: string,
  body: string,
): void {
  data.notifications.push({
    id: newId("noti"),
    org_id: scope.org_id,
    profile_id,
    type,
    title,
    body,
    read_at: null,
    created_at: nowIso(),
  });
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

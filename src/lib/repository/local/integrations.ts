/**
 * Integrações por pessoa.
 *
 * Cada profissional guarda as próprias credenciais: a agenda do Google é dela,
 * o número de WhatsApp é dela. Ninguém lê a credencial de ninguém — nem a
 * administração — e o valor nunca volta por inteiro depois de salvo.
 */

import { RepoError } from "../errors";
import { db, tx, inOrg, newId, nowIso } from "./helpers";
import type { Integration, IntegrationKind, Scope, Uuid } from "@/lib/domain/types";

/** O que a UI recebe: nunca o segredo inteiro. */
export interface IntegrationView {
  id: Uuid;
  kind: IntegrationKind;
  label: string | null;
  masked: string;
  extra: string | null;
  is_active: boolean;
  updated_at: string;
}

function mask(secret: string): string {
  const clean = secret.trim();
  if (clean.length <= 8) return "••••••••";
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

function toView(row: Integration): IntegrationView {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    masked: mask(row.secret),
    extra: row.extra,
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

export const integrations = {
  /** Só as da própria pessoa. Não existe caminho para ler a de outra. */
  async listMine(scope: Scope): Promise<IntegrationView[]> {
    return inOrg(db().integrations, scope)
      .filter((i) => i.profile_id === scope.profile_id)
      .map(toView);
  },

  async save(
    scope: Scope,
    input: {
      kind: IntegrationKind;
      secret: string;
      label?: string | null;
      extra?: string | null;
    },
  ): Promise<IntegrationView> {
    if (!input.secret.trim()) {
      throw new RepoError("validation", { field: "secret" });
    }
    return tx((data) => {
      const existing = data.integrations.find(
        (i) =>
          i.org_id === scope.org_id &&
          i.profile_id === scope.profile_id &&
          i.kind === input.kind,
      );

      if (existing) {
        existing.secret = input.secret.trim();
        existing.label = input.label?.trim() || null;
        existing.extra = input.extra?.trim() || null;
        existing.is_active = true;
        existing.updated_at = nowIso();
        return toView(existing);
      }

      const row: Integration = {
        id: newId("intg"),
        org_id: scope.org_id,
        profile_id: scope.profile_id,
        kind: input.kind,
        label: input.label?.trim() || null,
        secret: input.secret.trim(),
        extra: input.extra?.trim() || null,
        is_active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.integrations.push(row);
      return toView(row);
    });
  },

  async disconnect(scope: Scope, kind: IntegrationKind): Promise<void> {
    tx((data) => {
      const index = data.integrations.findIndex(
        (i) =>
          i.org_id === scope.org_id &&
          i.profile_id === scope.profile_id &&
          i.kind === kind,
      );
      if (index >= 0) data.integrations.splice(index, 1);
    });
  },
};

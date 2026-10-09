/**
 * Equipe.
 *
 * `deactivate` EXIGE destino dos pacientes na própria assinatura (CA-05):
 * a regra está no tipo, não numa validação que dá para esquecer.
 * Desligar nunca apaga — arquiva e transfere.
 */

import { RepoError } from "../errors";
import { db, tx, inOrg, newId, nowIso, requireFound, writeAudit } from "./helpers";
import { hasPermission, type Membership, type Profile, type Role, type Scope, type Uuid } from "@/lib/domain/types";

export interface MemberView extends Membership {
  profile: Profile;
  patient_count: number;
}

export const team = {
  async listMembers(scope: Scope): Promise<MemberView[]> {
    const data = db();
    return inOrg(data.memberships, scope)
      .map((membership) => {
        const profile = data.profiles.find((p) => p.id === membership.profile_id);
        if (!profile) return null;
        return {
          ...membership,
          profile,
          patient_count: data.patients.filter(
            (p) => p.org_id === scope.org_id && p.owner_id === profile.id,
          ).length,
        };
      })
      .filter((m): m is MemberView => m !== null)
      .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name, "pt-BR"));
  },

  async invite(
    scope: Scope,
    input: { full_name: string; email: string; role: Role; crp?: string | null },
  ): Promise<MemberView> {
    if (!hasPermission(scope, "team.manage")) throw new RepoError("forbidden");
    if (!input.full_name.trim() || !input.email.trim()) {
      throw new RepoError("validation", { fields: ["full_name", "email"] });
    }

    return tx((data) => {
      const profile: Profile = {
        id: newId("prfl"),
        full_name: input.full_name.trim(),
        email: input.email.trim(),
        phone: null,
        crp: input.crp ?? null,
        specialty: null,
        is_active: true,
        created_at: nowIso(),
      };
      data.profiles.push(profile);

      const membership: Membership = {
        id: newId("mbsp"),
        org_id: scope.org_id,
        profile_id: profile.id,
        role: input.role,
        status: "active",
        deactivated_at: null,
        patients_transferred_to: null,
        created_at: nowIso(),
      };
      data.memberships.push(membership);

      return { ...membership, profile, patient_count: 0 };
    });
  },

  async updateRole(scope: Scope, id: Uuid, role: Role): Promise<Membership> {
    if (!hasPermission(scope, "team.manage")) throw new RepoError("forbidden");
    return tx((data) => {
      const membership = requireFound(
        data.memberships.find((m) => m.id === id && m.org_id === scope.org_id),
      );
      const previous = membership.role;
      membership.role = role;
      writeAudit(data, scope, "permission.change", "membership", id, null, {
        from: previous,
        to: role,
      });
      return { ...membership };
    });
  },

  /**
   * Desligamento. Nunca apaga: transfere os pacientes, marca o vínculo como
   * inativo e registra tudo na auditoria.
   */
  async deactivate(
    scope: Scope,
    id: Uuid,
    input: { transfer_patients_to: Uuid; reason: string },
  ): Promise<Membership> {
    if (!hasPermission(scope, "team.manage")) throw new RepoError("forbidden");
    if (!input.reason.trim()) {
      throw new RepoError("validation", { field: "reason" });
    }

    return tx((data) => {
      const membership = requireFound(
        data.memberships.find((m) => m.id === id && m.org_id === scope.org_id),
      );
      if (membership.profile_id === input.transfer_patients_to) {
        throw new RepoError("validation", {
          field: "transfer_patients_to",
          message: "Escolha uma profissional diferente para assumir os pacientes.",
        });
      }

      const transferred = data.patients.filter(
        (p) => p.org_id === scope.org_id && p.owner_id === membership.profile_id,
      );
      transferred.forEach((p) => {
        p.owner_id = input.transfer_patients_to;
        p.updated_at = nowIso();
      });

      membership.status = "deactivated";
      membership.deactivated_at = nowIso();
      membership.patients_transferred_to = input.transfer_patients_to;

      writeAudit(
        data, scope, "member.deactivate", "membership", id, input.reason.trim(),
        {
          transferred_patients: transferred.length,
          transferred_to: input.transfer_patients_to,
        },
      );

      return { ...membership };
    });
  },

  /**
   * Editar dados pessoais. Cada pessoa edita o próprio cadastro; alterar o de
   * outra exige `team.manage`.
   */
  async updateProfile(
    scope: Scope,
    profileId: Uuid,
    input: { full_name?: string; email?: string; phone?: string | null; crp?: string | null; specialty?: string | null },
  ): Promise<Profile> {
    if (profileId !== scope.profile_id && !hasPermission(scope, "team.manage")) {
      throw new RepoError("forbidden");
    }
    return tx((data) => {
      const profile = requireFound(data.profiles.find((p) => p.id === profileId));
      if (input.full_name !== undefined) profile.full_name = input.full_name.trim();
      if (input.email !== undefined) profile.email = input.email.trim();
      if (input.phone !== undefined) profile.phone = input.phone || null;
      if (input.crp !== undefined) profile.crp = input.crp || null;
      if (input.specialty !== undefined) profile.specialty = input.specialty || null;
      return { ...profile };
    });
  },

  /** Profissionais que atendem — para seletores de agenda e responsável. */
  async listProfessionals(scope: Scope): Promise<Profile[]> {
    const data = db();
    const ids = inOrg(data.memberships, scope)
      .filter((m) => m.status === "active" && m.role !== "reception")
      .map((m) => m.profile_id);
    return data.profiles.filter((p) => ids.includes(p.id));
  },
};

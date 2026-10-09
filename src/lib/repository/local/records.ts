/**
 * Prontuário.
 *
 * Regra de acesso:
 *   - cada profissional vê as PRÓPRIAS evoluções;
 *   - para outra pessoa ler, a autora COMPARTILHA explicitamente
 *     (supervisão, discussão de caso, cobertura de férias);
 *   - o compartilhamento é revogável e fica na trilha de auditoria;
 *   - não existe permissão de "ler de todos" — nem para a dona da clínica.
 *
 * A recepção e a administração continuam vendo METADADOS (que houve sessão,
 * data, presença) porque isso é agenda e faturamento, não conteúdo clínico.
 */

import { RepoError } from "../errors";
import { paginate, type ListParams, type Page } from "../contract";
import {
  db, tx, inOrg, newId, nowIso, notify, requireFound, writeAudit,
} from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type {
  ClinicalRecord,
  ClinicalRecordMeta,
  RecordAddendum,
  RecordShare,
  Scope,
  Uuid,
} from "@/lib/domain/types";

/** Remove o conteúdo. É o que atravessa a fronteira quando não há permissão. */
function toMeta(record: ClinicalRecord): ClinicalRecordMeta {
  return {
    id: record.id,
    org_id: record.org_id,
    appointment_id: record.appointment_id,
    patient_id: record.patient_id,
    professional_id: record.professional_id,
    signed_at: record.signed_at,
    has_content: record.content.trim().length > 0,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function sharedWithMe(scope: Scope, recordId: Uuid): boolean {
  return db().record_shares.some(
    (s) =>
      s.org_id === scope.org_id &&
      s.record_id === recordId &&
      s.shared_with === scope.profile_id,
  );
}

export const records = {
  /**
   * Evoluções que a pessoa pode abrir: as próprias e as compartilhadas com ela.
   * Devolve metadados; o conteúdo só sai por `getContent`.
   */
  async listMeta(
    scope: Scope,
    params?: ListParams & { patient_id?: Uuid; professional_id?: Uuid },
  ): Promise<Page<ClinicalRecordMeta>> {
    const data = db();
    const sharedIds = new Set(
      data.record_shares
        .filter(
          (s) => s.org_id === scope.org_id && s.shared_with === scope.profile_id,
        )
        .map((s) => s.record_id),
    );

    let rows = inOrg(data.clinical_records, scope).filter(
      (r) => r.professional_id === scope.profile_id || sharedIds.has(r.id),
    );

    if (params?.patient_id) {
      rows = rows.filter((r) => r.patient_id === params.patient_id);
    }
    if (params?.professional_id) {
      rows = rows.filter((r) => r.professional_id === params.professional_id);
    }

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return paginate(rows.map(toMeta), params);
  },

  /**
   * Metadados de todas as evoluções do escopo — sem conteúdo.
   * Serve para a ficha do paciente mostrar que houve sessão registrada,
   * sem revelar nada do que foi escrito.
   */
  async listMetaAll(
    scope: Scope,
    params?: ListParams & { patient_id?: Uuid },
  ): Promise<Page<ClinicalRecordMeta>> {
    if (!hasPermission(scope, "record.metadata.read.any")) {
      return records.listMeta(scope, params);
    }
    let rows = inOrg(db().clinical_records, scope);
    if (params?.patient_id) {
      rows = rows.filter((r) => r.patient_id === params.patient_id);
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return paginate(rows.map(toMeta), params);
  },

  /**
   * Conteúdo completo.
   *   autora                      → devolve
   *   alguém com compartilhamento → devolve
   *   qualquer outro              → RepoError('forbidden')
   */
  async getContent(scope: Scope, id: Uuid): Promise<ClinicalRecord> {
    const record = requireFound(
      inOrg(db().clinical_records, scope).find((r) => r.id === id),
    );

    const isAuthor = record.professional_id === scope.profile_id;
    if (!isAuthor && !sharedWithMe(scope, id)) {
      throw new RepoError("forbidden", {
        professional_id: record.professional_id,
      });
    }

    tx((data) =>
      writeAudit(
        data, scope, "record.read", "clinical_record", id,
        isAuthor ? null : "acesso por compartilhamento",
      ),
    );
    return { ...record };
  },

  /* -------------------------------------------------- compartilhamento */

  async listShares(scope: Scope, recordId: Uuid): Promise<RecordShare[]> {
    return inOrg(db().record_shares, scope).filter(
      (s) => s.record_id === recordId,
    );
  },

  /** Só a autora compartilha a própria evolução. */
  async share(
    scope: Scope,
    recordId: Uuid,
    withProfileId: Uuid,
    note?: string,
  ): Promise<RecordShare> {
    const record = requireFound(
      inOrg(db().clinical_records, scope).find((r) => r.id === recordId),
    );
    if (record.professional_id !== scope.profile_id) {
      throw new RepoError("forbidden");
    }
    if (withProfileId === scope.profile_id) {
      throw new RepoError("validation", {
        field: "shared_with",
        message: "A evolução já é sua.",
      });
    }

    return tx((data) => {
      const existing = data.record_shares.find(
        (s) =>
          s.org_id === scope.org_id &&
          s.record_id === recordId &&
          s.shared_with === withProfileId,
      );
      if (existing) return { ...existing };

      const share: RecordShare = {
        id: newId("shar"),
        org_id: scope.org_id,
        record_id: recordId,
        patient_id: record.patient_id,
        shared_by: scope.profile_id,
        shared_with: withProfileId,
        note: note?.trim() || null,
        created_at: nowIso(),
      };
      data.record_shares.push(share);

      writeAudit(
        data, scope, "record.update", "clinical_record", recordId,
        "compartilhamento", { shared_with: withProfileId },
      );

      const author = data.profiles.find((p) => p.id === scope.profile_id);
      notify(
        data, scope, withProfileId,
        "record_shared",
        "Evolução compartilhada com você",
        `${author?.full_name ?? "Uma profissional"} compartilhou uma evolução com você${note?.trim() ? `: "${note.trim()}"` : "."}`,
      );

      return share;
    });
  },

  async revokeShare(scope: Scope, shareId: Uuid): Promise<void> {
    tx((data) => {
      const index = data.record_shares.findIndex(
        (s) => s.id === shareId && s.org_id === scope.org_id,
      );
      if (index < 0) return;
      const share = data.record_shares[index]!;
      if (share.shared_by !== scope.profile_id) {
        throw new RepoError("forbidden");
      }
      data.record_shares.splice(index, 1);
      writeAudit(
        data, scope, "record.update", "clinical_record", share.record_id,
        "compartilhamento revogado", { shared_with: share.shared_with },
      );
    });
  },

  /* ---------------------------------------------------------- escrita */

  async create(
    scope: Scope,
    input: {
      appointment_id: Uuid;
      patient_id: Uuid;
      content: string;
      template_id?: Uuid | null;
    },
  ): Promise<ClinicalRecord> {
    return tx((data) => {
      const record: ClinicalRecord = {
        id: newId("recd"),
        org_id: scope.org_id,
        appointment_id: input.appointment_id,
        patient_id: input.patient_id,
        professional_id: scope.profile_id,
        content: input.content,
        structured: null,
        template_id: input.template_id ?? null,
        signed_at: null,
        is_locked: false,
        has_content: input.content.trim().length > 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.clinical_records.push(record);
      writeAudit(data, scope, "record.create", "clinical_record", record.id);
      return record;
    });
  },

  async update(
    scope: Scope,
    id: Uuid,
    input: { content: string },
  ): Promise<ClinicalRecord> {
    return tx((data) => {
      const record = requireFound(
        data.clinical_records.find(
          (r) => r.id === id && r.org_id === scope.org_id,
        ),
      );
      if (record.professional_id !== scope.profile_id) {
        throw new RepoError("forbidden");
      }
      // Evolução assinada não se edita — correção é adendo (RF-04.11).
      if (record.is_locked) throw new RepoError("locked");

      record.content = input.content;
      record.has_content = input.content.trim().length > 0;
      record.updated_at = nowIso();
      writeAudit(data, scope, "record.update", "clinical_record", id);
      return { ...record };
    });
  },

  async sign(scope: Scope, id: Uuid): Promise<ClinicalRecord> {
    return tx((data) => {
      const record = requireFound(
        data.clinical_records.find(
          (r) => r.id === id && r.org_id === scope.org_id,
        ),
      );
      if (record.professional_id !== scope.profile_id) {
        throw new RepoError("forbidden");
      }
      record.signed_at = nowIso();
      record.is_locked = true;
      record.updated_at = nowIso();
      writeAudit(data, scope, "record.sign", "clinical_record", id);
      return { ...record };
    });
  },

  async addAddendum(
    scope: Scope,
    id: Uuid,
    content: string,
  ): Promise<RecordAddendum> {
    if (!content.trim()) throw new RepoError("validation", { field: "content" });
    return tx((data) => {
      const record = requireFound(
        data.clinical_records.find(
          (r) => r.id === id && r.org_id === scope.org_id,
        ),
      );
      if (record.professional_id !== scope.profile_id) {
        throw new RepoError("forbidden");
      }
      const addendum: RecordAddendum = {
        id: newId("addm"),
        org_id: scope.org_id,
        record_id: id,
        author_id: scope.profile_id,
        content: content.trim(),
        created_at: nowIso(),
      };
      data.record_addenda.push(addendum);
      writeAudit(data, scope, "record.update", "clinical_record", id, "adendo");
      return addendum;
    });
  },

  async listAddenda(scope: Scope, recordId: Uuid): Promise<RecordAddendum[]> {
    return inOrg(db().record_addenda, scope).filter(
      (a) => a.record_id === recordId,
    );
  },

  /**
   * Excluir evolução. Só a autora, e só enquanto não estiver assinada —
   * evolução assinada é documento: corrige-se por adendo, não se apaga.
   */
  async remove(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      const record = requireFound(
        data.clinical_records.find(
          (r) => r.id === id && r.org_id === scope.org_id,
        ),
      );
      if (record.professional_id !== scope.profile_id) {
        throw new RepoError("forbidden");
      }
      if (record.is_locked) throw new RepoError("locked");

      for (let i = data.record_addenda.length - 1; i >= 0; i--) {
        if (data.record_addenda[i]!.record_id === id) {
          data.record_addenda.splice(i, 1);
        }
      }
      for (let i = data.record_shares.length - 1; i >= 0; i--) {
        if (data.record_shares[i]!.record_id === id) {
          data.record_shares.splice(i, 1);
        }
      }
      const index = data.clinical_records.findIndex((r) => r.id === id);
      if (index >= 0) data.clinical_records.splice(index, 1);
      writeAudit(data, scope, "record.update", "clinical_record", id, "exclusão");
    });
  },

  /** Evolução de uma sessão específica, em metadados. */
  async metaByAppointment(
    scope: Scope,
    appointmentId: Uuid,
  ): Promise<ClinicalRecordMeta | null> {
    const record = inOrg(db().clinical_records, scope).find(
      (r) => r.appointment_id === appointmentId,
    );
    return record ? toMeta(record) : null;
  },
};

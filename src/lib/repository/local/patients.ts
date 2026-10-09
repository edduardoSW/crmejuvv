import { RepoError } from "../errors";
import { paginate, type ListParams, type Page } from "../contract";
import {
  db, tx, inOrg, newId, nowIso, requireFound, writeAudit,
} from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type {
  Patient, PatientDocument, PatientNote, Scope, Uuid,
} from "@/lib/domain/types";

export interface PatientInput {
  first_name: string;
  last_name: string | null;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  date_of_birth?: string | null;
  owner_id: Uuid;
  payment_type: "convenio" | "particular";
  health_plan_id?: Uuid | null;
  health_plan_number?: string | null;
  notes?: string | null;
}

export interface TimelineItem {
  kind: "appointment" | "document" | "payment";
  id: Uuid;
  at: string;
  title: string;
  detail: string;
  status?: string;
}

function fullName(p: Patient): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

export const patients = {
  async list(
    scope: Scope,
    params?: ListParams & {
      professional_id?: Uuid;
      health_plan_id?: Uuid;
      status?: "active" | "inactive";
    },
  ): Promise<Page<Patient>> {
    let rows = inOrg(db().patients, scope);

    // A psicóloga só enxerga os próprios pacientes — no repositório, não na tela.
    if (scope.allowed_professional_ids !== null) {
      const allowed = new Set(scope.allowed_professional_ids);
      rows = rows.filter((p) => allowed.has(p.owner_id));
    }
    if (params?.professional_id) {
      rows = rows.filter((p) => p.owner_id === params.professional_id);
    }
    if (params?.health_plan_id) {
      rows = rows.filter((p) => p.health_plan_id === params.health_plan_id);
    }
    if (params?.status) {
      rows = rows.filter((p) => p.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      rows = rows.filter(
        (p) =>
          fullName(p).toLowerCase().includes(q) ||
          p.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          (p.cpf ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      );
    }

    rows.sort((a, b) => fullName(a).localeCompare(fullName(b), "pt-BR"));
    return paginate(rows, params);
  },

  async get(scope: Scope, id: Uuid): Promise<Patient> {
    const patient = requireFound(
      inOrg(db().patients, scope).find((p) => p.id === id),
    );
    if (
      scope.allowed_professional_ids !== null &&
      !scope.allowed_professional_ids.includes(patient.owner_id)
    ) {
      throw new RepoError("forbidden");
    }
    return patient;
  },

  async create(scope: Scope, input: PatientInput): Promise<Patient> {
    if (!input.first_name.trim() || !input.phone.trim()) {
      throw new RepoError("validation", { fields: ["first_name", "phone"] });
    }
    return tx((data) => {
      const patient: Patient = {
        id: newId("patn"),
        org_id: scope.org_id,
        first_name: input.first_name.trim(),
        last_name: input.last_name?.trim() ?? null,
        phone: input.phone.trim(),
        email: input.email ?? null,
        cpf: input.cpf ?? null,
        date_of_birth: input.date_of_birth ?? null,
        address: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        notes: input.notes ?? null,
        avatar_url: null,
        owner_id: input.owner_id,
        payment_type: input.payment_type,
        health_plan_id: input.health_plan_id ?? null,
        health_plan_number: input.health_plan_number ?? null,
        status: "active",
        no_show_count: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.patients.push(patient);
      return patient;
    });
  },

  async update(
    scope: Scope,
    id: Uuid,
    input: Partial<PatientInput> & { status?: "active" | "inactive" },
  ): Promise<Patient> {
    return tx((data) => {
      const patient = requireFound(
        data.patients.find((p) => p.id === id && p.org_id === scope.org_id),
      );
      Object.assign(patient, input, { updated_at: nowIso() });
      return { ...patient };
    });
  },

  /** Transferência de responsabilidade — sempre auditada (RF-03.8). */
  async transfer(
    scope: Scope,
    id: Uuid,
    to_professional_id: Uuid,
    reason: string,
  ): Promise<Patient> {
    if (!reason.trim()) throw new RepoError("validation", { field: "reason" });
    return tx((data) => {
      const patient = requireFound(
        data.patients.find((p) => p.id === id && p.org_id === scope.org_id),
      );
      const from = patient.owner_id;
      patient.owner_id = to_professional_id;
      patient.updated_at = nowIso();
      writeAudit(data, scope, "patient.transfer", "patient", id, reason.trim(), {
        from,
        to: to_professional_id,
      });
      return { ...patient };
    });
  },

  /** Foto do paciente. Já chega redimensionada do cliente (base64). */
  async setAvatar(
    scope: Scope,
    id: Uuid,
    avatar_url: string | null,
  ): Promise<Patient> {
    return tx((data) => {
      const patient = requireFound(
        data.patients.find((p) => p.id === id && p.org_id === scope.org_id),
      );
      patient.avatar_url = avatar_url;
      patient.updated_at = nowIso();
      return { ...patient };
    });
  },

  /**
   * O que será apagado junto — o diálogo de confirmação mostra isto ANTES,
   * porque ninguém espera perder o histórico financeiro ao excluir um cadastro.
   */
  async removalImpact(
    scope: Scope,
    id: Uuid,
  ): Promise<{ appointments: number; records: number; notes: number; documents: number; entries: number }> {
    const data = db();
    const inThisOrg = <T extends { org_id: Uuid; patient_id: Uuid }>(rows: T[]) =>
      rows.filter((r) => r.org_id === scope.org_id && r.patient_id === id).length;

    return {
      appointments: inThisOrg(data.appointments),
      records: inThisOrg(data.clinical_records),
      notes: inThisOrg(data.patient_notes),
      documents: inThisOrg(data.documents),
      entries: inThisOrg(data.financial_entries),
    };
  },

  /**
   * Exclusão definitiva, em cascata.
   *
   * Arquivar (`status: 'inactive'`) é o caminho normal e preserva histórico —
   * é o que a clínica deve usar. Isto aqui existe para cadastro errado ou
   * duplicado, e por isso a UI exige confirmação por digitação.
   */
  async remove(scope: Scope, id: Uuid): Promise<void> {
    if (!hasPermission(scope, "patient.manage")) throw new RepoError("forbidden");

    tx((data) => {
      const patient = requireFound(
        data.patients.find((p) => p.id === id && p.org_id === scope.org_id),
      );

      const recordIds = new Set(
        data.clinical_records
          .filter((r) => r.patient_id === id && r.org_id === scope.org_id)
          .map((r) => r.id),
      );

      const drop = <T extends { org_id: Uuid }>(
        rows: T[],
        match: (row: T) => boolean,
      ) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i]!;
          if (row.org_id === scope.org_id && match(row)) rows.splice(i, 1);
        }
      };

      drop(data.record_addenda, (r) => recordIds.has(r.record_id));
      drop(data.record_shares, (r) => r.patient_id === id);
      drop(data.clinical_records, (r) => r.patient_id === id);
      drop(data.appointments, (r) => r.patient_id === id);
      drop(data.financial_entries, (r) => r.patient_id === id);
      drop(data.patient_notes, (r) => r.patient_id === id);
      drop(data.documents, (r) => r.patient_id === id);
      drop(data.anamneses, (r) => r.patient_id === id);
      drop(data.consents, (r) => r.patient_id === id);
      drop(data.patients, (r) => r.id === id);

      writeAudit(data, scope, "patient.transfer", "patient", id, "exclusão definitiva", {
        name: `${patient.first_name} ${patient.last_name ?? ""}`.trim(),
      });
    });
  },

  /* ------------------------------------------------------- documentos */

  async listDocuments(scope: Scope, patientId: Uuid): Promise<PatientDocument[]> {
    return inOrg(db().documents, scope)
      .filter((d) => d.patient_id === patientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  /**
   * Anexo (laudo, atestado, encaminhamento).
   * `data` chega em base64. O limite existe porque o localStorage tem ~5 MB e
   * base64 infla o arquivo em ~33% (RNF-10) — na fase 2 vira Supabase Storage.
   */
  async addDocument(
    scope: Scope,
    patientId: Uuid,
    input: { name: string; mime_type: string; size_bytes: number; data: string },
  ): Promise<PatientDocument> {
    const MAX_BYTES = 900 * 1024;
    if (input.size_bytes > MAX_BYTES) {
      throw new RepoError("quota_exceeded", {
        max_bytes: MAX_BYTES,
        got_bytes: input.size_bytes,
      });
    }
    return tx((data) => {
      const doc: PatientDocument = {
        id: newId("docu"),
        org_id: scope.org_id,
        patient_id: patientId,
        name: input.name,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        data: input.data,
        uploaded_by: scope.profile_id,
        created_at: nowIso(),
      };
      data.documents.push(doc);
      return doc;
    });
  },

  async deleteDocument(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      const index = data.documents.findIndex(
        (d) => d.id === id && d.org_id === scope.org_id,
      );
      if (index >= 0) data.documents.splice(index, 1);
    });
  },

  /* ------------------------------------------------------- anotações */

  async listNotes(scope: Scope, patientId: Uuid): Promise<PatientNote[]> {
    return inOrg(db().patient_notes, scope)
      .filter((n) => n.patient_id === patientId)
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  },

  async addNote(
    scope: Scope,
    patientId: Uuid,
    input: { content: string; kind?: PatientNote["kind"] },
  ): Promise<PatientNote> {
    if (!input.content.trim()) {
      throw new RepoError("validation", { field: "content" });
    }
    return tx((data) => {
      const note: PatientNote = {
        id: newId("note"),
        org_id: scope.org_id,
        patient_id: patientId,
        author_id: scope.profile_id,
        content: input.content.trim(),
        kind: input.kind ?? "geral",
        is_pinned: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.patient_notes.push(note);
      return note;
    });
  },

  async updateNote(
    scope: Scope,
    id: Uuid,
    input: { content?: string; kind?: PatientNote["kind"]; is_pinned?: boolean },
  ): Promise<PatientNote> {
    return tx((data) => {
      const note = requireFound(
        data.patient_notes.find((n) => n.id === id && n.org_id === scope.org_id),
      );
      if (input.content !== undefined) note.content = input.content.trim();
      if (input.kind !== undefined) note.kind = input.kind;
      if (input.is_pinned !== undefined) note.is_pinned = input.is_pinned;
      note.updated_at = nowIso();
      return { ...note };
    });
  },

  async deleteNote(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      const index = data.patient_notes.findIndex(
        (n) => n.id === id && n.org_id === scope.org_id,
      );
      if (index >= 0) data.patient_notes.splice(index, 1);
    });
  },

  /**
   * Linha do tempo unificada. Itens clínicos aparecem sempre como METADADOS —
   * conteúdo de evolução nunca atravessa esta função.
   */
  async timeline(
    scope: Scope,
    id: Uuid,
    params?: ListParams,
  ): Promise<Page<TimelineItem>> {
    const data = db();
    const items: TimelineItem[] = [];

    for (const a of data.appointments.filter(
      (x) => x.org_id === scope.org_id && x.patient_id === id,
    )) {
      const professional = data.profiles.find((p) => p.id === a.professional_id);
      const hasRecord = data.clinical_records.some(
        (r) => r.appointment_id === a.id,
      );
      items.push({
        kind: "appointment",
        id: a.id,
        at: a.starts_at,
        title: professional?.full_name ?? "Sessão",
        detail: hasRecord ? "Evolução registrada" : "Sem evolução registrada",
        status: a.status,
      });
    }

    for (const d of data.documents.filter(
      (x) => x.org_id === scope.org_id && x.patient_id === id,
    )) {
      items.push({
        kind: "document",
        id: d.id,
        at: d.created_at,
        title: d.name,
        detail: `${Math.round(d.size_bytes / 1024)} KB`,
      });
    }

    for (const e of data.financial_entries.filter(
      (x) => x.org_id === scope.org_id && x.patient_id === id && x.paid_at,
    )) {
      items.push({
        kind: "payment",
        id: e.id,
        at: e.paid_at!,
        title: `Pagamento, ${e.gross_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        detail: e.payment_method ?? "",
        status: e.status,
      });
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    return paginate(items, params);
  },
};

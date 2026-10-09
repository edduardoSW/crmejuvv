/**
 * Financeiro.
 *
 * O cálculo de repasse vive TODO neste arquivo, de propósito: o modelo de
 * repasse ainda não foi definido pela cliente (docs/00-descoberta.md §9,
 * pergunta 2). Trocar de modelo mexe só em `resolveRule` e `previewPayout`.
 */

import { RepoError } from "../errors";
import { paginate, type ListParams, type Page } from "../contract";
import { db, tx, inOrg, newId, nowIso, requireFound, writeAudit } from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type {
  BankTransaction,
  EntryStatus,
  FinancialEntry,
  PaymentMethod,
  PayoutRule,
  Scope,
  StatementSource,
  Uuid,
} from "@/lib/domain/types";

export interface PlanSummary {
  health_plan_id: Uuid | null;
  name: string;
  previsto: number;
  faturado: number;
  recebido: number;
  glosado: number;
  total: number;
  count: number;
}

export interface PayoutPreview {
  professional_id: Uuid;
  gross_total: number;
  payout_total: number;
  entries: { entry_id: Uuid; gross: number; payout: number; rule_id: Uuid | null }[];
}

/** Vence a regra mais específica: maior prioridade, menos campos nulos. */
function resolveRule(
  rules: PayoutRule[],
  entry: FinancialEntry,
  serviceId: Uuid | null,
): PayoutRule | null {
  const matches = rules.filter(
    (r) =>
      (r.professional_id === null || r.professional_id === entry.professional_id) &&
      (r.health_plan_id === null || r.health_plan_id === entry.health_plan_id) &&
      (r.service_id === null || r.service_id === serviceId),
  );
  if (!matches.length) return null;

  const specificity = (r: PayoutRule) =>
    (r.professional_id ? 1 : 0) + (r.health_plan_id ? 1 : 0) + (r.service_id ? 1 : 0);

  return matches.sort(
    (a, b) => b.priority - a.priority || specificity(b) - specificity(a),
  )[0]!;
}

export const finance = {
  async listEntries(
    scope: Scope,
    params?: ListParams & {
      from?: string;
      to?: string;
      status?: EntryStatus[];
      health_plan_id?: Uuid;
      professional_id?: Uuid;
      origin?: "convenio" | "particular";
    },
  ): Promise<Page<FinancialEntry>> {
    let rows = inOrg(db().financial_entries, scope);

    // A psicóloga não tem finance.read.all: só alcança os próprios lançamentos.
    if (!hasPermission(scope, "finance.read.all")) {
      rows = rows.filter((e) => e.professional_id === scope.profile_id);
    }
    if (params?.from) rows = rows.filter((e) => e.created_at >= params.from!);
    if (params?.to) rows = rows.filter((e) => e.created_at <= params.to!);
    if (params?.status?.length) {
      const filter = new Set(params.status);
      rows = rows.filter((e) => filter.has(e.status));
    }
    if (params?.health_plan_id) {
      rows = rows.filter((e) => e.health_plan_id === params.health_plan_id);
    }
    if (params?.professional_id) {
      rows = rows.filter((e) => e.professional_id === params.professional_id);
    }
    if (params?.origin) rows = rows.filter((e) => e.origin === params.origin);

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return paginate(rows, params);
  },

  async summaryByPlan(
    scope: Scope,
    params: { from: string; to: string },
  ): Promise<PlanSummary[]> {
    if (!hasPermission(scope, "finance.read.all")) throw new RepoError("forbidden");
    const data = db();
    const rows = inOrg(data.financial_entries, scope).filter(
      (e) => e.created_at >= params.from && e.created_at <= params.to,
    );

    const groups = new Map<string, PlanSummary>();
    for (const entry of rows) {
      const key = entry.health_plan_id ?? "particular";
      if (!groups.has(key)) {
        groups.set(key, {
          health_plan_id: entry.health_plan_id,
          name:
            data.health_plans.find((p) => p.id === entry.health_plan_id)?.name ??
            "Particular",
          previsto: 0, faturado: 0, recebido: 0, glosado: 0, total: 0, count: 0,
        });
      }
      const group = groups.get(key)!;
      group[entry.status] += entry.gross_amount;
      group.total += entry.gross_amount;
      group.count += 1;
    }

    return [...groups.values()].sort((a, b) => b.total - a.total);
  },

  async registerPayment(
    scope: Scope,
    id: Uuid,
    input: { method: PaymentMethod; paid_at?: string },
  ): Promise<FinancialEntry> {
    return tx((data) => {
      const entry = requireFound(
        data.financial_entries.find(
          (e) => e.id === id && e.org_id === scope.org_id,
        ),
      );
      entry.status = "recebido";
      entry.payment_method = input.method;
      entry.paid_at = input.paid_at ?? nowIso();
      return { ...entry };
    });
  },

  async registerGlosa(
    scope: Scope,
    id: Uuid,
    reason: string,
  ): Promise<FinancialEntry> {
    if (!reason.trim()) throw new RepoError("validation", { field: "reason" });
    return tx((data) => {
      const entry = requireFound(
        data.financial_entries.find(
          (e) => e.id === id && e.org_id === scope.org_id,
        ),
      );
      entry.status = "glosado";
      entry.glosa_reason = reason.trim();
      return { ...entry };
    });
  },

  /** Corrigir um lançamento — valor digitado errado, origem trocada, data. */
  async updateEntry(
    scope: Scope,
    id: Uuid,
    input: {
      gross_amount?: number;
      status?: EntryStatus;
      origin?: "convenio" | "particular";
      health_plan_id?: Uuid | null;
      payment_method?: PaymentMethod | null;
      due_date?: string | null;
      glosa_reason?: string | null;
    },
  ): Promise<FinancialEntry> {
    if (!hasPermission(scope, "finance.entry.manage")) {
      throw new RepoError("forbidden");
    }
    if (input.gross_amount !== undefined && input.gross_amount < 0) {
      throw new RepoError("validation", { field: "gross_amount" });
    }
    return tx((data) => {
      const entry = requireFound(
        data.financial_entries.find(
          (e) => e.id === id && e.org_id === scope.org_id,
        ),
      );
      Object.assign(entry, input);
      // Sair de "recebido" tem de limpar a liquidação, senão fica um
      // lançamento previsto com data de pagamento — e o relatório mente.
      if (input.status && input.status !== "recebido") {
        entry.paid_at = null;
      }
      if (input.status && input.status !== "glosado") {
        entry.glosa_reason = null;
      }
      return { ...entry };
    });
  },

  /**
   * Excluir lançamento. Some do faturamento do mês, então a UI pede
   * confirmação por digitação.
   */
  async removeEntry(scope: Scope, id: Uuid): Promise<void> {
    if (!hasPermission(scope, "finance.entry.manage")) {
      throw new RepoError("forbidden");
    }
    tx((data) => {
      const index = data.financial_entries.findIndex(
        (e) => e.id === id && e.org_id === scope.org_id,
      );
      if (index >= 0) data.financial_entries.splice(index, 1);
    });
  },

  /* ------------------------------------------------- extrato bancário */

  async listTransactions(
    scope: Scope,
    params?: { onlyPending?: boolean },
  ): Promise<BankTransaction[]> {
    if (!hasPermission(scope, "finance.entry.manage")) {
      throw new RepoError("forbidden");
    }
    let rows = inOrg(db().bank_transactions, scope);
    if (params?.onlyPending) {
      rows = rows.filter((t) => !t.matched_entry_id && !t.ignored);
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Importa linhas de extrato. Ignora duplicata pela combinação data + valor
   * + descrição, porque reimportar o mesmo arquivo é o erro mais comum.
   */
  async importTransactions(
    scope: Scope,
    lines: { date: string; description: string; amount: number }[],
    meta: { source: StatementSource; file_name: string | null },
  ): Promise<{ imported: number; duplicates: number }> {
    if (!hasPermission(scope, "finance.entry.manage")) {
      throw new RepoError("forbidden");
    }

    return tx((data) => {
      const existing = new Set(
        data.bank_transactions
          .filter((t) => t.org_id === scope.org_id)
          .map((t) => `${t.date}|${t.amount}|${t.description}`),
      );

      let imported = 0;
      let duplicates = 0;

      for (const line of lines) {
        const key = `${line.date}|${line.amount}|${line.description}`;
        if (existing.has(key)) {
          duplicates++;
          continue;
        }
        existing.add(key);
        data.bank_transactions.push({
          id: newId("bktx"),
          org_id: scope.org_id,
          date: line.date,
          description: line.description,
          amount: line.amount,
          source: meta.source,
          file_name: meta.file_name,
          matched_entry_id: null,
          ignored: false,
          imported_by: scope.profile_id,
          created_at: nowIso(),
        });
        imported++;
      }

      return { imported, duplicates };
    });
  },

  /**
   * Sugestão de conciliação: lançamento com o mesmo valor e data próxima.
   * Só sugere; quem confirma é a pessoa.
   */
  async suggestMatch(
    scope: Scope,
    transactionId: Uuid,
  ): Promise<FinancialEntry | null> {
    const data = db();
    const tx = inOrg(data.bank_transactions, scope).find(
      (t) => t.id === transactionId,
    );
    if (!tx || tx.amount <= 0) return null;

    const used = new Set(
      data.bank_transactions
        .filter((t) => t.org_id === scope.org_id && t.matched_entry_id)
        .map((t) => t.matched_entry_id),
    );

    const candidates = inOrg(data.financial_entries, scope)
      .filter(
        (e) =>
          !used.has(e.id) &&
          Math.abs(e.gross_amount - tx.amount) < 0.01,
      )
      .sort((a, b) => {
        const da = Math.abs(
          new Date(a.created_at).getTime() - new Date(`${tx.date}T12:00:00`).getTime(),
        );
        const dbb = Math.abs(
          new Date(b.created_at).getTime() - new Date(`${tx.date}T12:00:00`).getTime(),
        );
        return da - dbb;
      });

    return candidates[0] ?? null;
  },

  async matchTransaction(
    scope: Scope,
    transactionId: Uuid,
    entryId: Uuid | null,
  ): Promise<void> {
    tx((data) => {
      const row = requireFound(
        data.bank_transactions.find(
          (t) => t.id === transactionId && t.org_id === scope.org_id,
        ),
      );
      row.matched_entry_id = entryId;
      row.ignored = false;

      // Conciliar marca o lançamento como recebido: o dinheiro entrou no banco.
      if (entryId) {
        const entry = data.financial_entries.find((e) => e.id === entryId);
        if (entry && entry.status !== "recebido") {
          entry.status = "recebido";
          entry.paid_at = `${row.date}T12:00:00.000Z`;
        }
      }
    });
  },

  async ignoreTransaction(scope: Scope, transactionId: Uuid): Promise<void> {
    tx((data) => {
      const row = requireFound(
        data.bank_transactions.find(
          (t) => t.id === transactionId && t.org_id === scope.org_id,
        ),
      );
      row.ignored = !row.ignored;
      if (row.ignored) row.matched_entry_id = null;
    });
  },

  async removeTransaction(scope: Scope, transactionId: Uuid): Promise<void> {
    tx((data) => {
      const index = data.bank_transactions.findIndex(
        (t) => t.id === transactionId && t.org_id === scope.org_id,
      );
      if (index >= 0) data.bank_transactions.splice(index, 1);
    });
  },

  async listPayoutRules(scope: Scope): Promise<PayoutRule[]> {
    if (!hasPermission(scope, "finance.read.all")) throw new RepoError("forbidden");
    return inOrg(db().payout_rules, scope);
  },

  async upsertPayoutRule(
    scope: Scope,
    input: Omit<PayoutRule, "id" | "org_id"> & { id?: Uuid },
  ): Promise<PayoutRule> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    return tx((data) => {
      if (input.id) {
        const rule = requireFound(data.payout_rules.find((r) => r.id === input.id));
        Object.assign(rule, input);
        return { ...rule };
      }
      const rule: PayoutRule = { ...input, id: newId("pyrl"), org_id: scope.org_id };
      data.payout_rules.push(rule);
      return rule;
    });
  },

  async previewPayout(
    scope: Scope,
    params: { professional_id: Uuid; from: string; to: string },
  ): Promise<PayoutPreview> {
    // payout.read.own: a psicóloga só vê o próprio repasse.
    if (
      params.professional_id !== scope.profile_id &&
      !hasPermission(scope, "finance.read.all")
    ) {
      throw new RepoError("forbidden");
    }

    const data = db();
    const rules = inOrg(data.payout_rules, scope);
    const entries = inOrg(data.financial_entries, scope).filter(
      (e) =>
        e.professional_id === params.professional_id &&
        e.created_at >= params.from &&
        e.created_at <= params.to &&
        e.status === "recebido",
    );

    let gross_total = 0;
    let payout_total = 0;
    const items: PayoutPreview["entries"] = [];

    for (const entry of entries) {
      const appointment = data.appointments.find(
        (a) => a.id === entry.appointment_id,
      );
      const rule = resolveRule(rules, entry, appointment?.service_id ?? null);
      const payout = !rule
        ? 0
        : rule.kind === "percent"
          ? (entry.gross_amount * rule.value) / 100
          : rule.value;

      gross_total += entry.gross_amount;
      payout_total += payout;
      items.push({
        entry_id: entry.id,
        gross: entry.gross_amount,
        payout,
        rule_id: rule?.id ?? null,
      });
    }

    return {
      professional_id: params.professional_id,
      gross_total,
      payout_total,
      entries: items,
    };
  },

  async exportCsv(
    scope: Scope,
    params?: { from?: string; to?: string },
  ): Promise<string> {
    const page = await finance.listEntries(scope, { ...params, per_page: 100000 });
    const data = db();
    const header = [
      "data", "paciente", "profissional", "origem", "convenio",
      "valor", "status", "forma_pagamento",
    ].join(";");

    const lines = page.items.map((e) => {
      const patient = data.patients.find((p) => p.id === e.patient_id);
      const professional = data.profiles.find((p) => p.id === e.professional_id);
      const plan = data.health_plans.find((p) => p.id === e.health_plan_id);
      return [
        new Date(e.created_at).toLocaleDateString("pt-BR"),
        `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
        professional?.full_name ?? "",
        e.origin,
        plan?.name ?? "Particular",
        e.gross_amount.toFixed(2).replace(".", ","),
        e.status,
        e.payment_method ?? "",
      ].join(";");
    });

    tx((store) =>
      writeAudit(store, scope, "export.csv", "financial_entry", scope.org_id, null, {
        rows: lines.length,
      }),
    );

    return [header, ...lines].join("\n");
  },
};

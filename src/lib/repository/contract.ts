/**
 * Tipos do contrato — comuns às duas implementações (local e, na fase 2, supabase).
 * Espelha docs/04-contrato-api.md §2.
 */

import type { IsoDateTime, Uuid } from "@/lib/domain/types";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface Conflict {
  kind: "professional" | "room" | "patient";
  appointment_id: Uuid;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  /** Texto pronto para a UI — a mensagem precisa dizer QUAL recurso conflitou. */
  label: string;
}

export interface Period {
  from: IsoDateTime;
  to: IsoDateTime;
}

export function paginate<T>(items: T[], params?: ListParams): Page<T> {
  const page = params?.page ?? 1;
  const per_page = params?.per_page ?? 25;
  const start = (page - 1) * per_page;
  return {
    items: items.slice(start, start + per_page),
    total: items.length,
    page,
    per_page,
  };
}

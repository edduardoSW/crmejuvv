/**
 * Camada de persistência do protótipo.
 *
 * ESTE É O ÚNICO ARQUIVO DO PROJETO QUE PODE TOCAR EM localStorage.
 * Ver docs/01-requisitos.md RNF-01 e docs/04-contrato-api.md §4.
 *
 * Envelope versionado para permitir migração:
 *   { version: 1, updated_at: '…', data: { patients: [...], ... } }
 */

import { RepoError } from "./errors";
import type {
  Anamnesis,
  Appointment,
  AuditLog,
  BankTransaction,
  BillingBatch,
  Integration,
  RecordShare,
  ClinicalRecord,
  Consent,
  FinancialEntry,
  HealthPlan,
  Membership,
  Notification,
  Organization,
  Patient,
  PatientDocument,
  PatientNote,
  Payout,
  PayoutRule,
  Profile,
  ProfessionalSchedule,
  RecordAddendum,
  Room,
  ScheduleBlock,
  Service,
  ServicePrice,
  AiConversation,
  AiFolder,
  Task,
  Template,
} from "@/lib/domain/types";

/**
 * A versão faz parte da chave. Quando o formato da base muda de um jeito
 * que a migração não resolve (foi o caso ao passar de clínica para
 * consultório individual), basta subir a versão: o navegador ignora a base
 * antiga e semeia de novo, sem exigir que ninguém limpe nada à mão.
 */
export const STORAGE_KEY = "crm_exemplo_ejuvv:v1";
export const SCHEMA_VERSION = 1;

export interface Database {
  organizations: Organization[];
  profiles: Profile[];
  memberships: Membership[];
  health_plans: HealthPlan[];
  services: Service[];
  service_prices: ServicePrice[];
  rooms: Room[];
  professional_schedules: ProfessionalSchedule[];
  schedule_blocks: ScheduleBlock[];
  patients: Patient[];
  patient_notes: PatientNote[];
  appointments: Appointment[];
  clinical_records: ClinicalRecord[];
  record_addenda: RecordAddendum[];
  record_shares: RecordShare[];
  integrations: Integration[];
  anamneses: Anamnesis[];
  consents: Consent[];
  documents: PatientDocument[];
  templates: Template[];
  tasks: Task[];
  ai_folders: AiFolder[];
  ai_conversations: AiConversation[];
  financial_entries: FinancialEntry[];
  billing_batches: BillingBatch[];
  bank_transactions: BankTransaction[];
  payout_rules: PayoutRule[];
  payouts: Payout[];
  audit_logs: AuditLog[];
  notifications: Notification[];
}

interface Envelope {
  version: number;
  updated_at: string;
  data: Database;
}

export function emptyDatabase(): Database {
  return {
    organizations: [],
    profiles: [],
    memberships: [],
    health_plans: [],
    services: [],
    service_prices: [],
    rooms: [],
    professional_schedules: [],
    schedule_blocks: [],
    patients: [],
    patient_notes: [],
    appointments: [],
    clinical_records: [],
    record_addenda: [],
    record_shares: [],
    integrations: [],
    anamneses: [],
    consents: [],
    documents: [],
    templates: [],
    tasks: [],
    ai_folders: [],
    ai_conversations: [],
    financial_entries: [],
    billing_batches: [],
    bank_transactions: [],
    payout_rules: [],
    payouts: [],
    audit_logs: [],
    notifications: [],
  };
}

/* ------------------------------------------------------------- migrações */

type Migration = (data: Database) => Database;

/**
 * Migrações por versão de schema. A chave é a versão de ORIGEM.
 * Vazio hoje — existe para que a primeira mudança de schema não exija
 * inventar o mecanismo sob pressão.
 */
const MIGRATIONS: Record<number, Migration> = {};

function migrate(envelope: Envelope): Database {
  let { version, data } = envelope;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version += 1;
  }
  return { ...emptyDatabase(), ...data };
}

/* ------------------------------------------------------------ leitura/escrita */

const isBrowser = () => typeof window !== "undefined";

let cache: Database | null = null;

export function readDatabase(): Database {
  if (!isBrowser()) return emptyDatabase();
  if (cache) return cache;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cache = emptyDatabase();
    return cache;
  }

  try {
    const envelope = JSON.parse(raw) as Envelope;
    cache = migrate(envelope);
    return cache;
  } catch {
    // Dado corrompido não pode derrubar o app: recomeça limpo.
    console.warn("[store] dados locais ilegíveis, reiniciando a base");
    cache = emptyDatabase();
    return cache;
  }
}

/** Limite prático do localStorage na maioria dos navegadores. */
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export function writeDatabase(data: Database): void {
  if (!isBrowser()) return;
  const envelope: Envelope = {
    version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
    data,
  };
  const payload = JSON.stringify(envelope);

  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch (e) {
    // O limite do localStorage é ~5 MB e anexo em base64 estoura rápido.
    // O cache NÃO é atualizado aqui: se a gravação falhou, a memória não pode
    // divergir do que está persistido.
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new RepoError("quota_exceeded", {
        attempted_bytes: payload.length,
        limit_bytes: STORAGE_LIMIT_BYTES,
      });
    }
    throw e;
  }

  cache = data;
  notifySubscribers();
}

/** Lê, transforma e grava numa operação só. */
export function mutate<T>(fn: (db: Database) => T): T {
  const db = readDatabase();
  const result = fn(db);
  writeDatabase(db);
  return result;
}

export function resetDatabase(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  cache = null;
  notifySubscribers();
}

/* --------------------------------------------------------- reatividade */

const subscribers = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn());
}

/* -------------------------------------------------------------- storage */

export function storageUsage(): { bytes: number; percent: number } {
  if (!isBrowser()) return { bytes: 0, percent: 0 };
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
  const bytes = new Blob([raw]).size;
  const LIMIT = 5 * 1024 * 1024;
  return { bytes, percent: Math.min(100, (bytes / LIMIT) * 100) };
}

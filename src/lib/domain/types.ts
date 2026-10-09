/**
 * Modelo de domínio — fonte da verdade do protótipo.
 *
 * Nomes de campo em snake_case de propósito: são os mesmos que a fase 2 terá
 * no Postgres, o que elimina uma camada de tradução na migração.
 * Ver docs/03-modelo-de-dados.md
 */

export type Uuid = string;
export type IsoDateTime = string;
export type IsoDate = string;

/* ---------------------------------------------------------------- papéis */

export type Role = "owner" | "psychologist" | "reception";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dona / administradora",
  psychologist: "Psicóloga",
  reception: "Recepção",
};

/**
 * Permissões.
 *
 * Prontuário não tem permissão de "ler de todos": cada profissional vê as
 * próprias evoluções, e só enxerga a de outra pessoa se essa pessoa tiver
 * compartilhado explicitamente. Nem a dona escapa disso.
 */
export type Permission =
  | "patient.manage"
  | "record.read.own"
  | "record.share"
  | "record.metadata.read.any"
  | "appointment.manage.any"
  | "appointment.manage.own"
  | "finance.read.all"
  | "finance.entry.manage"
  | "payout.read.own"
  | "report.read.all"
  | "team.manage"
  | "audit.read"
  | "settings.manage";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "patient.manage",
    "record.read.own",
    "record.share",
    "record.metadata.read.any",
    "appointment.manage.any",
    "appointment.manage.own",
    "finance.read.all",
    "finance.entry.manage",
    "payout.read.own",
    "report.read.all",
    "team.manage",
    "audit.read",
    "settings.manage",
  ],
  psychologist: [
    "patient.manage",
    "record.read.own",
    "record.share",
    "appointment.manage.own",
    "payout.read.own",
  ],
  reception: [
    "patient.manage",
    "record.metadata.read.any",
    "appointment.manage.any",
    "appointment.manage.own",
    "finance.entry.manage",
  ],
};

/* ------------------------------------------------------ organização/pessoas */

export interface Organization {
  id: Uuid;
  name: string;
  slug: string;
  type: "consultorio" | "clinica";
  created_at: IsoDateTime;
}

export interface Profile {
  id: Uuid;
  full_name: string;
  email: string;
  phone: string | null;
  crp: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
}

export interface Membership {
  id: Uuid;
  org_id: Uuid;
  profile_id: Uuid;
  role: Role;
  status: "active" | "deactivated";
  deactivated_at: IsoDateTime | null;
  patients_transferred_to: Uuid | null;
  created_at: IsoDateTime;
}

/* ----------------------------------------------------------- cadastros */

export interface HealthPlan {
  id: Uuid;
  org_id: Uuid;
  name: string;
  ans_code: string | null;
  /** Logo da operadora em base64, enviada pela clínica. */
  logo_url: string | null;
  is_active: boolean;
}

export interface Service {
  id: Uuid;
  org_id: Uuid;
  name: string;
  duration_minutes: number;
  is_active: boolean;
}

export interface ServicePrice {
  id: Uuid;
  org_id: Uuid;
  service_id: Uuid;
  /** null = particular */
  health_plan_id: Uuid | null;
  price: number;
}

export interface Room {
  id: Uuid;
  org_id: Uuid;
  name: string;
  is_active: boolean;
}

export interface ProfessionalSchedule {
  id: Uuid;
  org_id: Uuid;
  professional_id: Uuid;
  /** 0 = domingo */
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface ScheduleBlock {
  id: Uuid;
  org_id: Uuid;
  professional_id: Uuid;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  reason: string;
}

/* ----------------------------------------------------------- pacientes */

export type PaymentType = "convenio" | "particular";

export interface Patient {
  id: Uuid;
  org_id: Uuid;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  cpf: string | null;
  date_of_birth: IsoDate | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  /** Foto em base64 (redimensionada no cliente). Ver docs/01-requisitos.md RNF-10. */
  avatar_url: string | null;
  /** Psicóloga responsável — eixo de toda a regra de sigilo. */
  owner_id: Uuid;
  payment_type: PaymentType;
  health_plan_id: Uuid | null;
  health_plan_number: string | null;
  status: "active" | "inactive";
  no_show_count: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * Anotação administrativa sobre o paciente.
 *
 * NÃO é prontuário: aqui vai recado de recepção, preferência de horário,
 * combinado de pagamento. Por isso é visível a quem gerencia o cadastro e
 * não passa pela regra de sigilo clínico — o conteúdo de sessão continua
 * exclusivamente em `clinical_records`.
 */
export interface PatientNote {
  id: Uuid;
  org_id: Uuid;
  patient_id: Uuid;
  author_id: Uuid;
  content: string;
  kind: "geral" | "contato" | "financeiro" | "agenda";
  is_pinned: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export const NOTE_KIND_LABELS: Record<PatientNote["kind"], string> = {
  geral: "Geral",
  contato: "Contato",
  financeiro: "Financeiro",
  agenda: "Agenda",
};

/* ------------------------------------------------------------- tarefas */

/**
 * Coluna do quadro / seção da lista. Um campo só governa as duas visões:
 * no Kanban vira coluna, na lista vira seção recolhível.
 */
export type TaskBucket = "hoje" | "futuras" | "revisao" | "concluidas";

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  hoje: "Prioridades do dia",
  futuras: "Tarefas futuras",
  revisao: "Em revisão",
  concluidas: "Concluídas",
};

export const TASK_BUCKET_ORDER: TaskBucket[] = [
  "hoje",
  "futuras",
  "revisao",
  "concluidas",
];

export type TaskStatus = "pendente" | "fazendo" | "feito";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: "Pendente",
  fazendo: "Fazendo",
  feito: "Feito",
};

export type TaskPriority = "baixa" | "media" | "alta";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export interface Task {
  id: Uuid;
  org_id: Uuid;
  title: string;
  description: string | null;
  bucket: TaskBucket;
  status: TaskStatus;
  priority: TaskPriority;
  /** null = sem data */
  due_date: IsoDate | null;
  /** Paciente relacionado, quando houver. */
  patient_id: Uuid | null;
  assignee_id: Uuid | null;
  created_by: Uuid;
  /** Posição dentro da coluna, para o arrastar do Kanban. */
  position: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/* -------------------------------------------------------------- agenda */

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  attended: "Atendida",
  no_show: "Faltou",
  cancelled: "Cancelada",
};

/** Reescrito para psicologia. O original do CRM de referência era de clínica geral. */
export type AppointmentType =
  | "sessao"
  | "avaliacao_inicial"
  | "devolutiva"
  | "retorno"
  | "sessao_grupo";

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  sessao: "Sessão",
  avaliacao_inicial: "Avaliação inicial",
  devolutiva: "Devolutiva",
  retorno: "Retorno",
  sessao_grupo: "Sessão em grupo",
};

export interface Appointment {
  id: Uuid;
  org_id: Uuid;
  patient_id: Uuid;
  professional_id: Uuid;
  service_id: Uuid;
  room_id: Uuid | null;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  status: AppointmentStatus;
  type: AppointmentType;
  is_overbook: boolean;
  rescheduled_from: Uuid | null;
  cancel_reason: string | null;
  reminder_sent_at: IsoDateTime | null;
  recurrence_group_id: Uuid | null;
  created_by: Uuid;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/* ---------------------------------------------------------- prontuário */

/**
 * Metadados da evolução: o que a dona e a recepção podem ver sem quebrar sigilo.
 *
 * A separação entre este tipo e `ClinicalRecord` é ESTRUTURAL, não cosmética:
 * um componente que recebe `ClinicalRecordMeta` não compila se tentar ler
 * `.content`. O TypeScript faz parte do controle de acesso.
 */
export interface ClinicalRecordMeta {
  id: Uuid;
  org_id: Uuid;
  appointment_id: Uuid;
  patient_id: Uuid;
  professional_id: Uuid;
  signed_at: IsoDateTime | null;
  has_content: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Conteúdo completo: só para a responsável, ou via acesso justificado. */
export interface ClinicalRecord extends ClinicalRecordMeta {
  content: string;
  structured: Record<string, unknown> | null;
  template_id: Uuid | null;
  is_locked: boolean;
}

export interface RecordAddendum {
  id: Uuid;
  org_id: Uuid;
  record_id: Uuid;
  author_id: Uuid;
  content: string;
  created_at: IsoDateTime;
}

/**
 * Compartilhamento de evolução.
 *
 * Prontuário é privado da autora. Para outra pessoa ler, a autora compartilha
 * explicitamente — supervisão, discussão de caso, cobertura de férias. O
 * compartilhamento é revogável e fica na auditoria.
 */
export interface RecordShare {
  id: Uuid;
  org_id: Uuid;
  record_id: Uuid;
  patient_id: Uuid;
  /** Quem compartilhou (a autora da evolução). */
  shared_by: Uuid;
  /** Com quem foi compartilhado. */
  shared_with: Uuid;
  note: string | null;
  created_at: IsoDateTime;
}

export interface Anamnesis {
  id: Uuid;
  org_id: Uuid;
  patient_id: Uuid;
  professional_id: Uuid;
  template_id: Uuid | null;
  answers: Record<string, unknown>;
  created_at: IsoDateTime;
}

export interface Consent {
  id: Uuid;
  org_id: Uuid;
  patient_id: Uuid;
  template_id: Uuid | null;
  signature_data: string | null;
  signed_at: IsoDateTime | null;
}

export interface PatientDocument {
  id: Uuid;
  org_id: Uuid;
  patient_id: Uuid;
  name: string;
  mime_type: string;
  size_bytes: number;
  /** base64 no protótipo; storage_path na fase 2 */
  data: string;
  uploaded_by: Uuid;
  created_at: IsoDateTime;
}

export interface Template {
  id: Uuid;
  org_id: Uuid;
  kind: "evolution" | "anamnesis" | "consent";
  name: string;
  body: string;
  service_id: Uuid | null;
}

/* ------------------------------------------------------------ financeiro */

export type EntryStatus = "previsto" | "faturado" | "recebido" | "glosado";

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  previsto: "Previsto",
  faturado: "Faturado",
  recebido: "Recebido",
  glosado: "Glosado",
};

export type PaymentMethod = "dinheiro" | "pix" | "cartao" | "convenio";

export interface FinancialEntry {
  id: Uuid;
  org_id: Uuid;
  appointment_id: Uuid;
  patient_id: Uuid;
  professional_id: Uuid;
  origin: PaymentType;
  health_plan_id: Uuid | null;
  gross_amount: number;
  status: EntryStatus;
  billing_batch_id: Uuid | null;
  due_date: IsoDate | null;
  paid_at: IsoDateTime | null;
  payment_method: PaymentMethod | null;
  glosa_reason: string | null;
  /** Reservado — TISS fica para a v2. Ver docs/01-requisitos.md RF-05.11 */
  tiss_guide_number: string | null;
  created_at: IsoDateTime;
}

export interface BillingBatch {
  id: Uuid;
  org_id: Uuid;
  health_plan_id: Uuid;
  period_start: IsoDate;
  period_end: IsoDate;
  status: "aberto" | "enviado" | "liquidado";
  total_amount: number;
  submitted_at: IsoDateTime | null;
}

/**
 * Regra de repasse — isolada de propósito.
 * O modelo de repasse ainda não foi definido pela cliente (docs/00-descoberta.md §9,
 * pergunta 2). Manter a regra aqui e o cálculo num único módulo permite trocar de
 * modelo sem tocar em mais nada.
 */
export interface PayoutRule {
  id: Uuid;
  org_id: Uuid;
  /** null = vale para todas as profissionais */
  professional_id: Uuid | null;
  /** null = qualquer convênio (e particular) */
  health_plan_id: Uuid | null;
  /** null = qualquer serviço */
  service_id: Uuid | null;
  kind: "percent" | "fixed";
  value: number;
  priority: number;
}

export interface Payout {
  id: Uuid;
  org_id: Uuid;
  professional_id: Uuid;
  period_start: IsoDate;
  period_end: IsoDate;
  gross_total: number;
  payout_total: number;
  status: "aberto" | "fechado" | "pago";
  closed_at: IsoDateTime | null;
}

/* -------------------------------------------------- auditoria/notificação */

export type AuditAction =
  | "record.read"
  | "record.read.justified"
  | "record.create"
  | "record.update"
  | "record.sign"
  | "patient.transfer"
  | "member.deactivate"
  | "permission.change"
  | "export.csv";

export interface AuditLog {
  id: Uuid;
  org_id: Uuid;
  actor_id: Uuid;
  action: AuditAction;
  entity: string;
  entity_id: Uuid;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: IsoDateTime;
}

export interface Notification {
  id: Uuid;
  org_id: Uuid;
  profile_id: Uuid;
  type: string;
  title: string;
  body: string;
  read_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

/* ----------------------------------------------------------------- escopo */

/**
 * Escopo de acesso. Toda função de repositório recebe isto como primeiro
 * argumento — não existe leitura sem escopo. É o mesmo contrato que a RLS
 * aplicará na fase 2, então regra errada aqui vira brecha de segurança lá.
 */
export interface Scope {
  org_id: Uuid;
  profile_id: Uuid;
  role: Role;
  /** null = toda a organização; array = whitelist de profissionais visíveis. */
  allowed_professional_ids: Uuid[] | null;
}

export function hasPermission(scope: Scope, permission: Permission): boolean {
  return ROLE_PERMISSIONS[scope.role].includes(permission);
}

export function buildScope(
  org_id: Uuid,
  profile_id: Uuid,
  role: Role,
): Scope {
  return {
    org_id,
    profile_id,
    role,
    allowed_professional_ids: role === "psychologist" ? [profile_id] : null,
  };
}

/* ------------------------------------------------- assistente (conversas) */

/**
 * Pasta do assistente. Serve para agrupar conversas por assunto ou por
 * paciente — quando `patient_id` está preenchido, a pasta é daquele paciente.
 */
export interface AiFolder {
  id: Uuid;
  org_id: Uuid;
  profile_id: Uuid;
  name: string;
  patient_id: Uuid | null;
  created_at: IsoDateTime;
}

export interface AiMessage {
  id: Uuid;
  from: "user" | "ai";
  text: string;
  created_at: IsoDateTime;
}

export interface AiConversation {
  id: Uuid;
  org_id: Uuid;
  /** Conversa é privada de quem criou — o assistente fala sobre a rotina dela. */
  profile_id: Uuid;
  title: string;
  folder_id: Uuid | null;
  patient_id: Uuid | null;
  is_pinned: boolean;
  messages: AiMessage[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}


/* -------------------------------------------------------- integrações */

export type IntegrationKind =
  | "google_calendar"
  | "evolution"
  | "resend"
  | "smtp"
  | "google_meet"
  | "zoom"
  | "teams"
  | "claude"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "kimi";

export const INTEGRATION_LABELS: Record<IntegrationKind, string> = {
  google_calendar: "Google Calendar",
  evolution: "WhatsApp · Evolution API",
  resend: "E-mail · Resend",
  smtp: "E-mail · SMTP",
  google_meet: "Videoconsulta · Google Meet",
  zoom: "Videoconsulta · Zoom",
  teams: "Videoconsulta · Microsoft Teams",
  claude: "Claude",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  kimi: "Kimi",
};

/** Modelos que podem responder pela Íris. Conecte o que preferir. */
export const AI_INTEGRATIONS: IntegrationKind[] = [
  "claude",
  "gemini",
  "deepseek",
  "qwen",
  "kimi",
];

/**
 * Credencial de integração, por PESSOA — não por clínica.
 *
 * Cada profissional conecta a própria agenda do Google e o próprio número de
 * WhatsApp; a chave de uma não serve para a outra. Guardada mascarada e nunca
 * exibida por inteiro depois de salva.
 */
export interface Integration {
  id: Uuid;
  org_id: Uuid;
  profile_id: Uuid;
  kind: IntegrationKind;
  /** Rótulo livre: "Agenda da clínica", "WhatsApp da recepção". */
  label: string | null;
  /** Chave/token. No protótipo fica no navegador; na fase 2 vai para o cofre. */
  secret: string;
  /** Campo extra por integração (URL da instância, ID da agenda). */
  extra: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}


/* ------------------------------------------------------ extrato bancário */

export type StatementSource = "csv" | "ofx" | "pdf" | "manual";

/**
 * Linha de extrato importada.
 *
 * Não vira lançamento automaticamente: extrato traz aluguel, tarifa e Pix de
 * terceiro junto com o que é receita da clínica. A pessoa concilia cada linha
 * com um lançamento existente, e o que sobra fica pendente.
 */
export interface BankTransaction {
  id: Uuid;
  org_id: Uuid;
  /** Data do lançamento no banco. */
  date: IsoDate;
  description: string;
  /** Positivo = entrada, negativo = saída. */
  amount: number;
  source: StatementSource;
  file_name: string | null;
  /** Lançamento do sistema com o qual esta linha foi conciliada. */
  matched_entry_id: Uuid | null;
  ignored: boolean;
  imported_by: Uuid;
  created_at: IsoDateTime;
}

# Etapa 4 — Contrato de API

**Regra central (RNF-02):** este documento e a interface do repositório do protótipo têm a
**mesma assinatura**. O protótipo implementa `localStorageRepo`; a fase 2 implementa
`supabaseRepo` contra os endpoints abaixo. Nenhum componente muda na troca.

```
src/lib/repository/
  index.ts          ← escolhe a implementação (1 arquivo, 1 flag)
  types.ts          ← a interface — este documento em TypeScript
  local/            ← implementação localStorage (protótipo)
  supabase/         ← implementação fase 2 (vazia por enquanto)
```

---

## 1. Princípios

1. **Toda operação recebe `Scope`** como primeiro argumento (`03-modelo-de-dados.md §4`).
   Não existe leitura sem escopo.
2. **Tudo é assíncrono** (`Promise`), inclusive no localStorage — senão a migração vira
   refactor de todo componente.
3. **Erros são tipados**, não strings. O componente decide a mensagem em pt-BR.
4. **Listagens são paginadas** desde o protótipo. Com 1.200 sessões, paginar depois é
   retrabalho.
5. **O servidor (fase 2) nunca confia no `Scope` que chega** — ele o recalcula da sessão
   autenticada. No protótipo o `Scope` é a única barreira; na fase 2 é conveniência de UI e
   a RLS é a barreira real.

## 2. Tipos comuns

```ts
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
  order?: 'asc' | 'desc';
}

export type RepoErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'conflict'            // conflito de agenda
  | 'requires_justification'
  | 'locked'              // evolução assinada
  | 'quota_exceeded';     // limite do localStorage

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    readonly detail?: Record<string, unknown>,
  ) { super(code); }
}
```

Mapeamento para HTTP na fase 2: `not_found` → 404 · `forbidden` → 403 · `validation` → 422 ·
`conflict` → 409 · `requires_justification` → 403 com `code` no corpo · `locked` → 423 ·
`quota_exceeded` → 413.

## 3. Interface

### 3.1 Pacientes

```ts
interface PatientsRepo {
  list(scope: Scope, params?: ListParams & {
    professional_id?: Uuid;
    health_plan_id?: Uuid;
    status?: 'active' | 'inactive';
  }): Promise<Page<Patient>>;

  get(scope: Scope, id: Uuid): Promise<Patient>;
  create(scope: Scope, input: PatientInput): Promise<Patient>;
  update(scope: Scope, id: Uuid, input: Partial<PatientInput>): Promise<Patient>;
  transfer(scope: Scope, id: Uuid, to_professional_id: Uuid, reason: string): Promise<Patient>;
  timeline(scope: Scope, id: Uuid, params?: ListParams): Promise<Page<TimelineItem>>;
}
```
`GET /patients` · `GET /patients/:id` · `POST /patients` · `PATCH /patients/:id` ·
`POST /patients/:id/transfer` · `GET /patients/:id/timeline`

`list` aplica `allowed_professional_ids` automaticamente: a psicóloga só recebe os próprios.
Não é filtro de UI — é do repositório.

`timeline` devolve sessões, documentos e pagamentos numa linha só. Itens clínicos vêm como
**metadados** quando `scope.can_read_clinical_content` é falso.

### 3.2 Agenda

```ts
interface AppointmentsRepo {
  list(scope: Scope, params: {
    from: IsoDateTime;
    to: IsoDateTime;
    professional_ids?: Uuid[];
    room_id?: Uuid;
    patient_id?: Uuid;
    status?: AppointmentStatus[];
  }): Promise<Appointment[]>;

  get(scope: Scope, id: Uuid): Promise<Appointment>;
  create(scope: Scope, input: AppointmentInput): Promise<Appointment>;
  reschedule(scope: Scope, id: Uuid, starts_at: IsoDateTime, room_id?: Uuid): Promise<Appointment>;
  cancel(scope: Scope, id: Uuid, reason: string): Promise<Appointment>;
  setStatus(scope: Scope, id: Uuid, status: AppointmentStatus): Promise<Appointment>;
  markReminderSent(scope: Scope, id: Uuid): Promise<Appointment>;
  checkConflicts(scope: Scope, input: AppointmentInput): Promise<Conflict[]>;
  availability(scope: Scope, params: {
    professional_id: Uuid; date: string; service_id: Uuid;
  }): Promise<TimeSlot[]>;
}

interface Conflict {
  kind: 'professional' | 'room' | 'patient';
  appointment_id: Uuid;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  label: string;   // "Ana Paula às 14:00" — texto pronto para a UI
}
```
`GET /appointments` · `POST /appointments` · `POST /appointments/:id/reschedule` ·
`POST /appointments/:id/cancel` · `PATCH /appointments/:id/status` ·
`POST /appointments/check-conflicts` · `GET /availability`

`create` e `reschedule` **falham com `conflict`** e devolvem os `Conflict[]` no `detail` —
por isso `Conflict.kind` existe: a mensagem tem de dizer qual dos três conflitou (CA-01).

`availability` é o que faz o JTBD 1 caber em três telas: devolve os horários livres da
profissional no dia, já descontando grade padrão, bloqueios e sessões existentes.

`setStatus('attended')` dispara o lançamento financeiro (RF-05.1) — efeito colateral
documentado, dentro do repositório, para que protótipo e backend se comportem igual.

### 3.3 Prontuário — onde mora a regra de sigilo

```ts
interface RecordsRepo {
  /** Sempre permitido no escopo; devolve metadados, nunca conteúdo. */
  listMeta(scope: Scope, params: {
    patient_id?: Uuid; professional_id?: Uuid;
  } & ListParams): Promise<Page<ClinicalRecordMeta>>;

  /**
   * Conteúdo completo.
   * - responsável → devolve
   * - owner sem grant válido → RepoError('requires_justification')
   * - demais → RepoError('forbidden')
   */
  getContent(scope: Scope, id: Uuid): Promise<ClinicalRecord>;

  /** Cria o grant, audita e notifica. Depois disso, getContent passa a responder. */
  requestJustifiedAccess(scope: Scope, id: Uuid, reason: string): Promise<AccessGrant>;

  create(scope: Scope, input: RecordInput): Promise<ClinicalRecord>;
  update(scope: Scope, id: Uuid, input: Partial<RecordInput>): Promise<ClinicalRecord>;
  sign(scope: Scope, id: Uuid): Promise<ClinicalRecord>;
  addAddendum(scope: Scope, id: Uuid, content: string): Promise<RecordAddendum>;
}
```
`GET /records` · `GET /records/:id/content` · `POST /records/:id/justified-access` ·
`POST /records` · `PATCH /records/:id` · `POST /records/:id/sign` ·
`POST /records/:id/addenda`

Quatro invariantes:

1. `listMeta` **não tem** caminho que devolva `content`. A separação é de tipo
   (`03-modelo-de-dados.md §3`), então tentar acessar `.content` num `ClinicalRecordMeta`
   nem compila.
2. Todo `getContent` bem-sucedido grava `audit_logs` — inclusive o da própria responsável.
3. `requestJustifiedAccess` exige `reason` não vazio, grava `clinical_access_grants` com
   `expires_at`, e enfileira notificação à responsável. Sem exceção, sem caminho silencioso.
4. `update` em registro com `is_locked` devolve `locked`. Correção é `addAddendum`.

### 3.4 Financeiro

```ts
interface FinanceRepo {
  listEntries(scope: Scope, params: {
    from?: string; to?: string;
    status?: EntryStatus[];
    health_plan_id?: Uuid;
    professional_id?: Uuid;
    origin?: 'convenio' | 'particular';
  } & ListParams): Promise<Page<FinancialEntry>>;

  summaryByPlan(scope: Scope, params: { from: string; to: string }): Promise<PlanSummary[]>;
  registerPayment(scope: Scope, id: Uuid, input: PaymentInput): Promise<FinancialEntry>;
  createBatch(scope: Scope, input: BatchInput): Promise<BillingBatch>;
  setBatchStatus(scope: Scope, id: Uuid, status: string): Promise<BillingBatch>;
  registerGlosa(scope: Scope, id: Uuid, reason: string, amount: number): Promise<FinancialEntry>;

  // Repasse — módulo isolado (a regra não está decidida)
  listPayoutRules(scope: Scope): Promise<PayoutRule[]>;
  upsertPayoutRule(scope: Scope, input: PayoutRuleInput): Promise<PayoutRule>;
  previewPayout(scope: Scope, params: {
    professional_id: Uuid; from: string; to: string;
  }): Promise<PayoutPreview>;
  closePayout(scope: Scope, input: ClosePayoutInput): Promise<Payout>;

  exportCsv(scope: Scope, params: ExportParams): Promise<Blob>;
}
```
`GET /finance/entries` · `GET /finance/summary` · `POST /finance/entries/:id/payment` ·
`POST /finance/batches` · `PATCH /finance/batches/:id` · `POST /finance/entries/:id/glosa` ·
`GET|PUT /finance/payout-rules` · `GET /finance/payouts/preview` · `POST /finance/payouts` ·
`GET /finance/export`

`finance.read.all` é exclusivo da dona; a psicóloga só alcança `previewPayout` do próprio
`professional_id` (`payout.read.own`). O repositório força isso — não é filtro de tela.

### 3.5 Relatórios, equipe, configurações, auditoria

```ts
interface ReportsRepo {
  overview(scope: Scope, p: Period): Promise<Overview>;          // KPIs + deltas
  byProfessional(scope: Scope, p: Period): Promise<ProfessionalStats[]>;
  occupancy(scope: Scope, p: Period): Promise<OccupancySeries>;
  noShows(scope: Scope, p: Period): Promise<NoShowSeries>;
  revenueByPlan(scope: Scope, p: Period): Promise<RevenueSeries>;
}

interface TeamRepo {
  listMembers(scope: Scope): Promise<Membership[]>;
  invite(scope: Scope, input: InviteInput): Promise<Membership>;
  updateRole(scope: Scope, id: Uuid, role: Role): Promise<Membership>;
  /** Nunca apaga. Exige destino dos pacientes. */
  deactivate(scope: Scope, id: Uuid, input: {
    transfer_patients_to: Uuid; reason: string;
  }): Promise<Membership>;
}

interface SettingsRepo {
  healthPlans / services / rooms / templates / schedules / permissions  // CRUD por escopo
  resetDemoData(scope: Scope): Promise<void>;
}

interface AuditRepo {
  list(scope: Scope, params: {
    actor_id?: Uuid; entity?: string; action?: string; from?: string; to?: string;
  } & ListParams): Promise<Page<AuditLog>>;
}
```
`GET /reports/*` · `GET /team` · `POST /team/invite` · `PATCH /team/:id` ·
`POST /team/:id/deactivate` · CRUD em `/settings/*` · `GET /audit`

`deactivate` **exige** `transfer_patients_to` (CA-05). Não existe assinatura que permita
desligar sem destino — a regra está no tipo, não numa validação que dá para esquecer.

`AuditRepo.list` só responde a quem tem `audit.read` (dona). É a única leitura que a própria
dona não pode filtrar para esconder as próprias ações.

## 4. Implementação no protótipo

| Aspecto | Protótipo | Fase 2 |
|---|---|---|
| Transporte | função local, `await` imediato | `fetch` / cliente Supabase |
| Chave | `crm_tatiana:v1:<entidade>` no localStorage | tabelas Postgres |
| Escopo | filtro no repositório | filtro + **RLS** (barreira real) |
| Paginação | `slice` em memória | `range` / `limit-offset` |
| Anexos | base64, com teto e erro `quota_exceeded` | Supabase Storage |
| CSV | gerado no client | idem, ou no servidor |
| Auditoria | grava na mesma store | tabela append-only, sem `update`/`delete` |
| Conflito de agenda | validação no repositório | `EXCLUDE USING gist` + validação |

Envelope no storage, com versão (RNF-09):

```ts
{ version: 1, updated_at: '…', data: { patients: [...], appointments: [...] } }
```

## 5. Como se verifica que o contrato foi cumprido

- [ ] `grep -r "localStorage" src/ --exclude-dir=repository` retorna vazio (RNF-01)
- [ ] Toda função pública do repositório tem `Scope` como primeiro parâmetro
- [ ] Cada método aqui tem endpoint correspondente na tabela de rotas
- [ ] `getContent` sem grant devolve `requires_justification`, nunca conteúdo
- [ ] `deactivate` não compila sem `transfer_patients_to`
- [ ] Nenhum componente importa de `repository/local/` — só de `repository/`

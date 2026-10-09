/**
 * Seed determinístico de demonstração.
 *
 * DADOS 100% FICTÍCIOS. Ver docs/01-requisitos.md RNF-04 e RNF-08.
 * PRNG com semente fixa: duas restaurações produzem exatamente a mesma base.
 *
 * Organização e pessoas inteiramente fictícias para o CRM Exemplo da EJUVV.
 */

import { emptyDatabase, type Database } from "@/lib/repository/store";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  ClinicalRecord,
  FinancialEntry,
  Patient,
  Uuid,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ PRNG */

/** mulberry32 — determinístico, rápido, suficiente para seed. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260817;

/** `let` porque `buildSeed` reinicia o gerador — sem isso, a segunda chamada
 *  produziria dados diferentes da primeira e o RNF-08 cairia. */
let rng = makeRng(SEED);

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const chance = (p: number) => rng() < p;

/** IDs determinísticos — nada de Math.random (defeito herdado do CRM de referência). */
let idCounter = 0;
function uid(prefix: string): Uuid {
  idCounter += 1;
  const n = idCounter.toString(16).padStart(12, "0");
  return `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${n}`;
}

/* ------------------------------------------------------------------ dados */

const FIRST_NAMES = [
  "Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela",
  "Helena", "Isabela", "Juliana", "Larissa", "Mariana", "Natália", "Patrícia",
  "Rafaela", "Sofia", "Tatiane", "Vanessa", "Bruno", "Carlos", "Diego",
  "Eduardo", "Felipe", "Gustavo", "Henrique", "João", "Lucas", "Marcelo",
  "Paulo", "Rodrigo", "Thiago", "Vitor",
];

const LAST_NAMES = [
  "Almeida", "Barbosa", "Cardoso", "Duarte", "Esteves", "Ferreira", "Gomes",
  "Henriques", "Ibrahim", "Junqueira", "Klein", "Lima", "Machado", "Nunes",
  "Oliveira", "Pereira", "Queiroz", "Ribeiro", "Santos", "Teixeira", "Vieira",
];

const SPECIALTIES = [
  "Terapia Cognitivo-Comportamental",
  "Psicanálise",
  "Terapia Sistêmica",
  "Psicologia Infantil",
  "Neuropsicologia",
];

const CANCEL_REASONS = [
  "Paciente solicitou cancelamento",
  "Imprevisto da profissional",
  "Paciente com atestado médico",
  "Remarcado a pedido do paciente",
];

const EVOLUTION_SAMPLES = [
  "Paciente relatou melhora no padrão de sono desde a última sessão. Trabalhamos técnicas de reestruturação cognitiva aplicadas ao contexto de trabalho. Demonstrou boa adesão às tarefas de casa.",
  "Sessão focada no manejo de ansiedade antecipatória. Aplicado exercício de respiração diafragmática. Paciente identificou três gatilhos recorrentes no ambiente familiar.",
  "Retomada do vínculo terapêutico após duas semanas de intervalo. Paciente trouxe conteúdo relacionado a conflito com figura parental. Mantido o plano terapêutico atual.",
  "Discussão sobre limites nas relações interpessoais. Paciente demonstrou avanço na assertividade. Proposta de registro de situações durante a semana.",
  "Trabalho com luto. Paciente conseguiu nomear sentimentos que antes evitava. Ritmo respeitado, sem forçar elaboração.",
];

/* ------------------------------------------------------------- utilidades */

function daysAgo(n: number): Date {
  const d = new Date(2026, 7, 17, 9, 0, 0, 0); // 17/08/2026, base fixa
  d.setDate(d.getDate() - n);
  return d;
}

function atHour(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function phone(): string {
  return `(21) 9${int(1000, 9999)}-${int(1000, 9999)}`;
}

function cpf(): string {
  return `${int(100, 999)}.${int(100, 999)}.${int(100, 999)}-${int(10, 99)}`;
}

/* ---------------------------------------------------------------- builder */

export interface SeedOptions {
  /**
   * Semanas de histórico por paciente (teto). Existe para o seed poder ENCOLHER
   * quando o navegador recusa a gravação: a cota do localStorage varia entre
   * navegadores e é contada em UTF-16, então nenhum tamanho fixo é seguro.
   * Ver `resetToSeed` em repository/local/helpers.ts.
   */
  historyWeeks?: number;
}

export function buildSeed(options: SeedOptions = {}): Database {
  const historyWeeks = options.historyWeeks ?? 26;
  // Determinismo (RNF-08): mesma entrada, mesma base — sempre.
  rng = makeRng(SEED);
  idCounter = 0;
  const db = emptyDatabase();
  const now = new Date(2026, 7, 17).toISOString();

  /* --- organização ------------------------------------------------------ */

  // Uma só. O modelo suporta várias (org_id em toda entidade), mas a base de
  // demonstração é de consultório individual.
  const consultorioId = uid("org1");

  db.organizations.push({
    id: consultorioId,
    name: "Clínica Exemplo",
    slug: "clinica-exemplo",
    type: "consultorio",
    created_at: now,
  });

  /* --- pessoa ----------------------------------------------------------- */

  const demoOwnerId = uid("prof");
  db.profiles.push({
    id: demoOwnerId,
    full_name: "Marina Costa",
    email: "demo@ejuvv.com",
    phone: phone(),
    crp: "05/12345",
    specialty: "Terapia Cognitivo-Comportamental",
    is_active: true,
    created_at: now,
  });

  db.memberships.push({
    id: uid("memb"),
    org_id: consultorioId,
    profile_id: demoOwnerId,
    role: "owner",
    status: "active",
    deactivated_at: null,
    patients_transferred_to: null,
    created_at: now,
  });

  /* --- cadastros -------------------------------------------------------- */

  const orgs = [
    // Só Petrobras: é o único convênio que ela atende hoje. O resto é particular.
    {
      id: consultorioId,
      professionals: [demoOwnerId],
      roomCount: 2,
      patientCount: 120,
      plans: ["Petrobras"],
    },
  ];

  for (const org of orgs) {
    /* convênios */
    const planIds: Uuid[] = org.plans.map((name) => {
      const id = uid("plan");
      db.health_plans.push({
        id, org_id: org.id, name,
        ans_code: String(int(300000, 399999)),
        logo_url: null,
        is_active: true,
      });
      return id;
    });

    /* serviços */
    const serviceDefs = [
      { name: "Sessão individual", duration: 50 },
      { name: "Avaliação inicial", duration: 60 },
      { name: "Devolutiva", duration: 50 },
      { name: "Sessão em grupo", duration: 90 },
    ];
    const serviceIds: Uuid[] = serviceDefs.map((s) => {
      const id = uid("serv");
      db.services.push({
        id, org_id: org.id, name: s.name,
        duration_minutes: s.duration, is_active: true,
      });
      // Particular
      db.service_prices.push({
        id: uid("prc"), org_id: org.id, service_id: id,
        health_plan_id: null, price: s.duration >= 60 ? 260 : 200,
      });
      // Por convênio (valor menor, como na vida real)
      planIds.forEach((planId) => {
        db.service_prices.push({
          id: uid("prc"), org_id: org.id, service_id: id,
          health_plan_id: planId, price: s.duration >= 60 ? 145 : 110,
        });
      });
      return id;
    });

    /* salas */
    const roomIds: Uuid[] = [];
    for (let i = 1; i <= org.roomCount; i++) {
      const id = uid("room");
      db.rooms.push({ id, org_id: org.id, name: `Sala ${i}`, is_active: true });
      roomIds.push(id);
    }

    /* grade padrão: seg–sex, 8h–18h */
    org.professionals.forEach((pid) => {
      for (let wd = 1; wd <= 5; wd++) {
        db.professional_schedules.push({
          id: uid("schd"), org_id: org.id, professional_id: pid,
          weekday: wd, start_time: "08:00", end_time: "18:00",
        });
      }
    });

    /* templates */
    db.templates.push(
      {
        id: uid("tpl"), org_id: org.id, kind: "evolution",
        name: "Evolução de sessão (padrão)",
        body: "Queixa trazida:\n\nIntervenções realizadas:\n\nObservações:\n\nPlano para a próxima sessão:",
        service_id: null,
      },
      {
        id: uid("tpl"), org_id: org.id, kind: "anamnesis",
        name: "Anamnese inicial",
        body: "Motivo da procura:\n\nHistórico:\n\nUso de medicação:\n\nRede de apoio:",
        service_id: null,
      },
      {
        id: uid("tpl"), org_id: org.id, kind: "consent",
        name: "Termo de consentimento informado",
        body: "Declaro estar ciente das condições do atendimento psicológico, incluindo sigilo profissional e suas exceções previstas em lei.",
        service_id: null,
      },
    );

    /* --- pacientes ------------------------------------------------------ */

    const patientIds: Uuid[] = [];
    for (let i = 0; i < org.patientCount; i++) {
      const id = uid("pat");
      const isConvenio = chance(0.72); // maioria por convênio (PDF §1)
      const planId = isConvenio ? pick(planIds) : null;
      const patient: Patient = {
        id,
        org_id: org.id,
        first_name: pick(FIRST_NAMES),
        last_name: pick(LAST_NAMES),
        phone: phone(),
        email: null,
        cpf: cpf(),
        date_of_birth: `19${int(60, 99)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
        address: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        notes: null,
        avatar_url: null,
        owner_id: pick(org.professionals),
        payment_type: isConvenio ? "convenio" : "particular",
        health_plan_id: planId,
        health_plan_number: isConvenio ? String(int(10000000, 99999999)) : null,
        status: chance(0.88) ? "active" : "inactive",
        no_show_count: 0,
        created_at: daysAgo(int(30, 400)).toISOString(),
        updated_at: now,
      };
      db.patients.push(patient);
      patientIds.push(id);
    }

    /* --- agenda: 6 meses, sessões semanais recorrentes ------------------ */

    const activePatients = db.patients.filter(
      (p) => p.org_id === org.id && p.status === "active",
    );

    for (const patient of activePatients) {
      const professionalId = patient.owner_id;
      const serviceId = serviceIds[0]!;
      const weekday = int(1, 5);
      const hour = int(8, 17);
      const recurrenceId = uid("recg");
      const roomId = roomIds.length ? roomIds[int(0, roomIds.length - 1)]! : null;

      /**
       * Cada paciente entrou em tratamento numa semana diferente e tem uma
       * cadência própria (semanal ou quinzenal). Além de ser mais realista que
       * "todo mundo desde sempre, toda semana", mantém o volume dentro do que
       * docs/03-modelo-de-dados.md §6 especifica — e portanto dentro do limite
       * de ~5 MB do localStorage (RNF-10).
       */
      const startWeek = int(2, historyWeeks);
      const cadence = chance(0.5) ? 1 : 2;

      for (let week = startWeek; week >= -2; week -= cadence) {
        if (chance(0.08)) continue; // falhas naturais na sequência

        const base = daysAgo(week * 7);
        const dayDiff = weekday - base.getDay();
        base.setDate(base.getDate() + dayDiff);
        const starts = atHour(base, hour);
        const isFuture = starts.getTime() > new Date(2026, 7, 17, 12).getTime();

        let status: AppointmentStatus;
        if (isFuture) {
          status = chance(0.4) ? "confirmed" : "scheduled";
        } else if (chance(0.12)) {
          status = "no_show";
        } else if (chance(0.07)) {
          status = "cancelled";
        } else {
          status = "attended";
        }

        const type: AppointmentType =
          week === startWeek ? "avaliacao_inicial" : "sessao";
        const ends = new Date(starts.getTime() + 50 * 60 * 1000);
        const appointmentId = uid("appt");

        const appointment: Appointment = {
          id: appointmentId,
          org_id: org.id,
          patient_id: patient.id,
          professional_id: professionalId,
          service_id: serviceId,
          room_id: roomId,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          status,
          type,
          is_overbook: chance(0.04),
          rescheduled_from: null,
          cancel_reason: status === "cancelled" ? pick(CANCEL_REASONS) : null,
          reminder_sent_at:
            !isFuture || chance(0.6) ? daysAgo(week * 7 + 1).toISOString() : null,
          recurrence_group_id: recurrenceId,
          created_by: demoOwnerId,
          created_at: daysAgo(week * 7 + 14).toISOString(),
          updated_at: now,
        };
        db.appointments.push(appointment);

        if (status === "no_show") {
          patient.no_show_count += 1;
        }

        /* evolução da sessão atendida */
        if (status === "attended") {
          const record: ClinicalRecord = {
            id: uid("rec"),
            org_id: org.id,
            appointment_id: appointmentId,
            patient_id: patient.id,
            professional_id: professionalId,
            content: pick(EVOLUTION_SAMPLES),
            structured: null,
            template_id: null,
            signed_at: chance(0.7) ? ends.toISOString() : null,
            is_locked: false,
            has_content: true,
            created_at: ends.toISOString(),
            updated_at: ends.toISOString(),
          };
          record.is_locked = record.signed_at !== null;
          db.clinical_records.push(record);
        }

        /* lançamento financeiro (RF-05.1) */
        if (status === "attended" || status === "no_show") {
          const price = db.service_prices.find(
            (sp) =>
              sp.service_id === serviceId &&
              sp.health_plan_id === patient.health_plan_id,
          );
          const amount = price?.price ?? 200;
          let entryStatus: FinancialEntry["status"];
          if (patient.payment_type === "particular") {
            entryStatus = chance(0.9) ? "recebido" : "previsto";
          } else if (week > 8) {
            entryStatus = chance(0.85) ? "recebido" : "glosado";
          } else if (week > 4) {
            entryStatus = "faturado";
          } else {
            entryStatus = "previsto";
          }

          db.financial_entries.push({
            id: uid("fin"),
            org_id: org.id,
            appointment_id: appointmentId,
            patient_id: patient.id,
            professional_id: professionalId,
            origin: patient.payment_type,
            health_plan_id: patient.health_plan_id,
            gross_amount: status === "no_show" ? amount * 0.5 : amount,
            status: entryStatus,
            billing_batch_id: null,
            due_date: null,
            paid_at: entryStatus === "recebido" ? ends.toISOString() : null,
            payment_method:
              patient.payment_type === "particular"
                ? pick(["pix", "cartao", "dinheiro"] as const)
                : "convenio",
            glosa_reason:
              entryStatus === "glosado" ? "Guia sem autorização prévia" : null,
            tiss_guide_number: null,
            created_at: ends.toISOString(),
          });
        }
      }
    }
  }

  /* --- tarefas de exemplo ---------------------------------------------- */

  const TASK_SEEDS: {
    title: string;
    bucket: "hoje" | "futuras" | "revisao" | "concluidas";
    status: "pendente" | "fazendo" | "feito";
    priority: "baixa" | "media" | "alta";
    days: number | null;
  }[] = [
    { title: "Confirmar sessões de amanhã por WhatsApp", bucket: "hoje", status: "fazendo", priority: "alta", days: 0 },
    { title: "Enviar guias da Petrobras do mês", bucket: "hoje", status: "pendente", priority: "alta", days: 1 },
    { title: "Retornar ligação da paciente em lista de espera", bucket: "hoje", status: "pendente", priority: "media", days: 0 },
    { title: "Fechar o financeiro do mês", bucket: "futuras", status: "pendente", priority: "alta", days: 8 },
    { title: "Renovar contrato da sala", bucket: "futuras", status: "pendente", priority: "baixa", days: 22 },
    { title: "Marcar minha supervisão clínica", bucket: "futuras", status: "pendente", priority: "media", days: 14 },
    { title: "Revisar termos de consentimento atualizados", bucket: "revisao", status: "fazendo", priority: "media", days: 4 },
    { title: "Conferir glosas recusadas pela operadora", bucket: "revisao", status: "fazendo", priority: "alta", days: 2 },
    { title: "Atualizar tabela de valores particulares", bucket: "concluidas", status: "feito", priority: "media", days: -6 },
    { title: "Atualizar termo de consentimento", bucket: "concluidas", status: "feito", priority: "baixa", days: -20 },
  ];

  for (const org of orgs) {
    const people = org.professionals;
    const orgPatients = db.patients.filter((p) => p.org_id === org.id);

    TASK_SEEDS.forEach((t, i) => {
      const due =
        t.days === null
          ? null
          : daysAgo(-t.days).toISOString().slice(0, 10);
      db.tasks.push({
        id: uid("task"),
        org_id: org.id,
        title: t.title,
        description: null,
        bucket: t.bucket,
        status: t.status,
        priority: t.priority,
        due_date: due,
        patient_id: chance(0.3) && orgPatients.length ? pick(orgPatients).id : null,
        assignee_id: people[i % people.length]!,
        created_by: demoOwnerId,
        position: i + 1,
        created_at: daysAgo(int(1, 20)).toISOString(),
        updated_at: now,
      });
    });
  }

  return db;
}

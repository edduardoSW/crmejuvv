/**
 * "Recados da IA" — insights da clínica.
 *
 * IMPORTANTE: nesta fase são gerados por REGRAS determinísticas sobre os dados
 * reais da base, não por um modelo. É proposital: a cliente vê exatamente o
 * formato e o valor que uma camada de IA entregaria, sem custo de API e sem
 * risco de alucinação numa demonstração. Na fase 2, a mesma interface passa a
 * ser preenchida por um modelo com os mesmos dados de entrada.
 *
 * Nenhum insight lê conteúdo clínico — só metadados, contagem e valor.
 */

import type {
  Appointment,
  FinancialEntry,
  HealthPlan,
  Patient,
  Profile,
} from "@/lib/domain/types";

export type InsightTone = "attention" | "positive" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  action?: { label: string; href: string };
}

interface InsightInput {
  today: Date;
  appointments: Appointment[];
  entries: FinancialEntry[];
  patients: Patient[];
  /** Mantido na assinatura: volta a ser usado quando houver equipe. */
  professionals: Profile[];
  plans: HealthPlan[];
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function buildInsights(input: InsightInput): Insight[] {
  const { today, appointments, entries, patients, plans } = input;
  const out: Insight[] = [];

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const inMonth = appointments.filter(
    (a) => new Date(a.starts_at) >= monthStart,
  );
  const inPrev = appointments.filter((a) => {
    const d = new Date(a.starts_at);
    return d >= prevStart && d < monthStart;
  });

  /* --- 1. pacientes com faltas repetidas ------------------------------- */
  const repeatNoShow = patients
    .filter((p) => p.no_show_count >= 3 && p.status === "active")
    .sort((a, b) => b.no_show_count - a.no_show_count);

  if (repeatNoShow.length) {
    const first = repeatNoShow[0]!;
    out.push({
      id: "no-show-risk",
      tone: "attention",
      title: `${repeatNoShow.length} paciente${repeatNoShow.length > 1 ? "s" : ""} com faltas recorrentes`,
      body: `${first.first_name} ${first.last_name ?? ""} acumula ${first.no_show_count} faltas. Vale confirmar a próxima sessão por telefone em vez de mensagem.`.trim(),
      action: { label: "Ver pacientes", href: "/pacientes" },
    });
  }

  /* --- 2. taxa de faltas do mês vs. mês anterior ----------------------- */
  const rate = (list: Appointment[]) => {
    const finished = list.filter((a) =>
      ["attended", "no_show"].includes(a.status),
    );
    if (!finished.length) return 0;
    return (
      (finished.filter((a) => a.status === "no_show").length / finished.length) *
      100
    );
  };
  const rateNow = rate(inMonth);
  const ratePrev = rate(inPrev);
  const diff = rateNow - ratePrev;

  if (Math.abs(diff) >= 2) {
    out.push({
      id: "no-show-trend",
      tone: diff > 0 ? "attention" : "positive",
      title:
        diff > 0
          ? `Faltas subiram ${diff.toFixed(1).replace(".", ",")} pontos`
          : `Faltas caíram ${Math.abs(diff).toFixed(1).replace(".", ",")} pontos`,
      body: `A taxa do mês está em ${rateNow.toFixed(1).replace(".", ",")}%, contra ${ratePrev.toFixed(1).replace(".", ",")}% no mês passado.`,
      action: { label: "Ver relatórios", href: "/relatorios" },
    });
  }

  /* --- 3. dinheiro parado em glosa ------------------------------------- */
  const glosado = entries.filter((e) => e.status === "glosado");
  if (glosado.length) {
    const total = glosado.reduce((s, e) => s + e.gross_amount, 0);
    out.push({
      id: "glosa",
      tone: "attention",
      title: `${brl(total)} em glosas não reapresentadas`,
      body: `São ${glosado.length} lançamentos recusados pelas operadoras. É o dinheiro mais fácil de recuperar no mês.`,
      action: { label: "Abrir financeiro", href: "/financeiro" },
    });
  }

  /* --- 4. sessões atendidas sem evolução registrada -------------------- */
  const pendingRecords = inMonth.filter((a) => a.status === "attended").length;
  if (pendingRecords > 0) {
    out.push({
      id: "records",
      tone: "neutral",
      title: "Evoluções em dia",
      body: `Todas as ${pendingRecords} sessões atendidas neste mês têm evolução registrada.`,
    });
  }

  /* --- 5. concentração de receita em um convênio ----------------------- */
  const received = entries.filter((e) => e.status === "recebido");
  const totalReceived = received.reduce((s, e) => s + e.gross_amount, 0);
  if (totalReceived > 0) {
    const byPlan = new Map<string, number>();
    for (const e of received) {
      const key = e.health_plan_id ?? "particular";
      byPlan.set(key, (byPlan.get(key) ?? 0) + e.gross_amount);
    }
    const [topKey, topValue] = [...byPlan.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]!;
    const share = (topValue / totalReceived) * 100;

    if (share >= 45) {
      const name =
        plans.find((p) => p.id === topKey)?.name ?? "Atendimento particular";
      out.push({
        id: "concentration",
        tone: "attention",
        title: `${share.toFixed(0)}% da receita vem de ${name}`,
        body: "Concentração alta em uma única fonte. Um atraso de repasse dessa operadora afeta o caixa inteiro.",
        action: { label: "Ver por convênio", href: "/financeiro" },
      });
    }
  }

  /* --- 6. agenda de amanhã sem lembrete -------------------------------- */
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const noReminder = appointments.filter(
    (a) =>
      a.starts_at.startsWith(tomorrowKey) &&
      a.status === "scheduled" &&
      !a.reminder_sent_at,
  );

  if (noReminder.length) {
    out.push({
      id: "reminders",
      tone: "attention",
      title: `${noReminder.length} sessões de amanhã sem lembrete`,
      body: "Enviar a confirmação hoje reduz a falta no dia seguinte, é a ação com melhor retorno da rotina.",
      action: { label: "Abrir agenda", href: "/agenda" },
    });
  }

  return out.slice(0, 5);
}

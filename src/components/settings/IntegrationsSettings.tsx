"use client";

/**
 * Integrações da pessoa logada: Google Calendar, Claude e Evolution API.
 *
 * As credenciais são individuais — a agenda do Google é dela, o número de
 * WhatsApp é dela. Ninguém lê a chave de ninguém, e o valor nunca volta por
 * inteiro depois de salvo.
 *
 * PROTÓTIPO: nada é conectado de verdade. As chaves ficam no navegador para
 * demonstrar o fluxo; na fase 2 vão para um cofre no servidor.
 */

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { INTEGRATION_LABELS, type IntegrationKind } from "@/lib/domain/types";
import type { IntegrationView } from "@/lib/repository/local/integrations";
import {
  IconAlert, IconCheck, IconSparkle, IconCalendar, IconSend, IconVideo,
} from "@/components/icons";

interface Spec {
  kind: IntegrationKind;
  category: "produtividade" | "video" | "email" | "ia";
  description: string;
  secretLabel: string;
  secretHint: string;
  /** Campos além do segredo. Mais de um vira JSON no `extra`. */
  fields?: { key: string; label: string; hint?: string }[];
  icon: React.ReactNode;
  tone: [string, string];
  steps: { title: string; detail: string }[];
  docs: { label: string; url: string };
}

const SPECS: Spec[] = [
  {
    kind: "google_calendar",
    category: "produtividade",
    description:
      "Espelha as sessões na sua agenda do Google, com o horário e o nome da paciente.",
    secretLabel: "Chave da API (API key ou client secret)",
    secretHint: "Começa com AIza… ou GOCSPX…",
    fields: [
      {
        key: "calendar_id",
        label: "ID da agenda",
        hint: "Ex.: seuemail@gmail.com ou o ID de uma agenda específica",
      },
    ],
    icon: <IconCalendar width={19} height={19} />,
    tone: ["var(--color-info-soft)", "var(--color-info)"],
    docs: {
      label: "Google Cloud Console",
      url: "https://console.cloud.google.com/apis/credentials",
    },
    steps: [
      {
        title: "Abra o Google Cloud Console",
        detail:
          "Entre em console.cloud.google.com com a conta Google que tem a agenda. Se ainda não houver projeto, clique em “Novo projeto”, dê um nome (ex.: Clínica Exemplo) e crie.",
      },
      {
        title: "Ative a Google Calendar API",
        detail:
          "No menu, vá em “APIs e serviços” → “Biblioteca”, busque por Google Calendar API e clique em Ativar.",
      },
      {
        title: "Crie a credencial",
        detail:
          "Em “APIs e serviços” → “Credenciais”, clique em “Criar credenciais”. Para leitura simples, escolha Chave de API. Para escrever na agenda, escolha ID do cliente OAuth, tipo Aplicativo da Web.",
      },
      {
        title: "Restrinja a chave",
        detail:
          "Ainda em Credenciais, abra a chave criada e limite o uso à Google Calendar API. Isso evita que a chave sirva para outra coisa se vazar.",
      },
      {
        title: "Copie a chave e o ID da agenda",
        detail:
          "Copie o valor da credencial. O ID da agenda está em calendar.google.com → engrenagem → Configurações da agenda → “Integrar agenda” → ID da agenda.",
      },
    ],
  },
  {
    kind: "google_meet",
    category: "video",
    description:
      "Cria o link do Meet junto com a sessão e envia para a paciente. Usa a mesma conta Google da agenda.",
    secretLabel: "Client secret do OAuth",
    secretHint: "Começa com GOCSPX-",
    fields: [
      {
        key: "client_id",
        label: "Client ID",
        hint: "Termina em .apps.googleusercontent.com",
      },
    ],
    icon: <IconVideo width={19} height={19} />,
    tone: ["var(--color-info-soft)", "var(--color-info)"],
    docs: {
      label: "Google Cloud Console",
      url: "https://console.cloud.google.com/apis/credentials",
    },
    steps: [
      {
        title: "Use o mesmo projeto da agenda",
        detail:
          "O link do Meet nasce de um evento do Google Calendar, então reaproveite o projeto que você criou para a agenda. Não precisa de outro.",
      },
      {
        title: "Ative a Calendar API",
        detail:
          "Em “APIs e serviços” → “Biblioteca”, confirme que a Google Calendar API está ativada. É ela que cria a conferência junto com o evento.",
      },
      {
        title: "Crie a credencial OAuth",
        detail:
          "Em “Credenciais” → “Criar credenciais” → “ID do cliente OAuth”, escolha Aplicativo da Web. Meet exige OAuth: chave de API sozinha não cria conferência.",
      },
      {
        title: "Configure a tela de consentimento",
        detail:
          "Preencha nome do app e e-mail de suporte, e adicione o escopo calendar.events. Enquanto o app estiver em teste, cadastre as psicólogas como usuárias de teste.",
      },
      {
        title: "Copie Client ID e secret",
        detail:
          "Os dois aparecem ao criar a credencial. O secret começa com GOCSPX-.",
      },
    ],
  },
  {
    kind: "zoom",
    category: "video",
    description:
      "Cria a reunião no Zoom no horário da sessão, com sala de espera ativada.",
    secretLabel: "Client secret",
    secretHint: "Copiado da app Server-to-Server OAuth",
    fields: [
      { key: "account_id", label: "Account ID", hint: "Encontrado na mesma tela da app" },
      { key: "client_id", label: "Client ID", hint: "Copiado da app" },
    ],
    icon: <IconVideo width={19} height={19} />,
    tone: ["var(--color-accent-soft)", "var(--color-accent-ink)"],
    docs: {
      label: "Zoom App Marketplace",
      url: "https://marketplace.zoom.us/develop/create",
    },
    steps: [
      {
        title: "Entre no Marketplace do Zoom",
        detail:
          "Acesse marketplace.zoom.us com a conta que hospeda as sessões e vá em “Develop” → “Build App”.",
      },
      {
        title: "Escolha Server-to-Server OAuth",
        detail:
          "É o tipo certo para um sistema criar reuniões sozinho, sem a psicóloga autorizar toda vez.",
      },
      {
        title: "Copie as três credenciais",
        detail:
          "A app mostra Account ID, Client ID e Client Secret. Os três são necessários.",
      },
      {
        title: "Adicione os escopos",
        detail:
          "Na aba Scopes, inclua meeting:write (criar reunião) e meeting:read. Sem eles a chamada volta com erro de permissão.",
      },
      {
        title: "Ative a app",
        detail:
          "Na aba Activation, clique em Activate. Enquanto não ativar, as credenciais existem mas não funcionam.",
      },
    ],
  },
  {
    kind: "teams",
    category: "video",
    description:
      "Cria a reunião no Teams junto com a sessão. Indicado para quem já usa Microsoft 365.",
    secretLabel: "Client secret (valor)",
    secretHint: "Copie o Value, não o Secret ID",
    fields: [
      { key: "tenant_id", label: "Directory (tenant) ID", hint: "Da visão geral do app" },
      { key: "client_id", label: "Application (client) ID", hint: "Da visão geral do app" },
    ],
    icon: <IconVideo width={19} height={19} />,
    tone: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
    docs: {
      label: "Portal do Microsoft Entra",
      url: "https://entra.microsoft.com",
    },
    steps: [
      {
        title: "Abra o portal do Entra",
        detail:
          "Acesse entra.microsoft.com com uma conta de administrador do Microsoft 365 da clínica e vá em “Registros de aplicativo”.",
      },
      {
        title: "Registre o aplicativo",
        detail:
          "Clique em “Novo registro”, dê o nome CRM Exemplo EJUVV e conclua. Anote o Application ID e o Directory ID que aparecem na visão geral.",
      },
      {
        title: "Gere o secret",
        detail:
          "Em “Certificados e segredos” → “Novo segredo do cliente”, defina a validade e copie o campo Value assim que aparecer. Ele some depois que você sai da tela.",
      },
      {
        title: "Dê as permissões",
        detail:
          "Em “Permissões de API”, adicione Microsoft Graph → OnlineMeetings.ReadWrite e conceda o consentimento do administrador.",
      },
      {
        title: "Confirme a licença",
        detail:
          "A conta que hospeda as sessões precisa de licença do Teams. Sem licença o registro funciona mas a reunião não é criada.",
      },
    ],
  },
  {
    kind: "resend",
    category: "email",
    description:
      "Envia recibo, confirmação de sessão e lembrete por e-mail, no domínio da clínica.",
    secretLabel: "Chave da API",
    secretHint: "Começa com re_",
    fields: [
      {
        key: "from",
        label: "Remetente",
        hint: "Ex.: contato@clinicaexemplo.com.br",
      },
    ],
    icon: <IconSend width={19} height={19} />,
    tone: ["var(--color-accent-soft)", "var(--color-accent-ink)"],
    docs: { label: "Painel do Resend", url: "https://resend.com/api-keys" },
    steps: [
      {
        title: "Crie a conta",
        detail:
          "Acesse resend.com e cadastre-se. O plano gratuito envia alguns milhares de e-mails por mês, o que costuma bastar para uma clínica.",
      },
      {
        title: "Verifique o domínio",
        detail:
          "Em “Domains”, adicione o domínio da clínica. O Resend mostra registros DNS (SPF, DKIM) para incluir onde o domínio está hospedado. Sem isso, o e-mail cai em spam ou é recusado.",
      },
      {
        title: "Espere a verificação",
        detail:
          "O DNS leva de minutos a algumas horas para propagar. O domínio precisa aparecer como Verified antes de enviar.",
      },
      {
        title: "Gere a chave",
        detail:
          "Em “API Keys”, clique em “Create API Key”. Escolha permissão de envio (Sending access) e copie o valor, que começa com re_.",
      },
      {
        title: "Defina o remetente",
        detail:
          "Use um endereço do domínio verificado, como contato@clinicaexemplo.com.br. Gmail e Hotmail não funcionam como remetente aqui.",
      },
    ],
  },
  {
    kind: "smtp",
    category: "email",
    description:
      "Usa um e-mail que a clínica já tem, como Google Workspace ou o do provedor do site.",
    secretLabel: "Senha ou senha de app",
    secretHint: "No Gmail, use senha de app, não a senha da conta",
    fields: [
      { key: "host", label: "Servidor (host)", hint: "Ex.: smtp.gmail.com" },
      { key: "port", label: "Porta", hint: "587 com TLS, 465 com SSL" },
      { key: "user", label: "Usuário", hint: "Normalmente o e-mail completo" },
      { key: "from", label: "Remetente", hint: "Nome e e-mail que a paciente verá" },
    ],
    icon: <IconSend width={19} height={19} />,
    tone: ["var(--color-info-soft)", "var(--color-info)"],
    docs: {
      label: "Senhas de app do Google",
      url: "https://myaccount.google.com/apppasswords",
    },
    steps: [
      {
        title: "Descubra os dados do seu provedor",
        detail:
          "Google Workspace e Gmail usam smtp.gmail.com na porta 587. Outros provedores informam host e porta no painel de e-mail.",
      },
      {
        title: "Ative a verificação em duas etapas",
        detail:
          "No Gmail, a senha de app só aparece depois que a verificação em duas etapas estiver ativa na conta.",
      },
      {
        title: "Gere uma senha de app",
        detail:
          "Acesse myaccount.google.com/apppasswords, escolha “Outro”, dê o nome CRM Exemplo EJUVV e copie os 16 caracteres gerados.",
      },
      {
        title: "Use a senha de app aqui",
        detail:
          "Cole a senha de app no campo de senha, nunca a senha da conta. Se alguém tiver acesso ao sistema, a senha de app pode ser revogada sozinha, sem trocar a senha do e-mail.",
      },
      {
        title: "Teste antes de confiar",
        detail:
          "Envie para o seu próprio endereço e confira se chegou na caixa de entrada e não no spam.",
      },
    ],
  },
  {
    kind: "claude",
    category: "ia",
    description:
      "Liga a Íris a um modelo de verdade. Sem chave, ela responde por regras sobre os seus dados.",
    secretLabel: "Chave da API",
    secretHint: "Começa com sk-ant-",
    icon: <IconSparkle width={19} height={19} />,
    tone: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
    docs: {
      label: "Console da Anthropic",
      url: "https://console.anthropic.com/settings/keys",
    },
    steps: [
      {
        title: "Crie a conta",
        detail:
          "Acesse console.anthropic.com e entre. É a conta de desenvolvedor, diferente do Claude do dia a dia.",
      },
      {
        title: "Adicione crédito",
        detail:
          "Em “Billing”, adicione um método de pagamento e compre crédito. Sem crédito a chave existe mas toda chamada falha.",
      },
      {
        title: "Gere a chave",
        detail:
          "Vá em “API keys” → “Create key”, dê um nome (ex.: CRM Exemplo EJUVV) e copie o valor. Ele aparece uma única vez, se perder, é preciso gerar outra.",
      },
      {
        title: "Defina um limite de gasto",
        detail:
          "Ainda em Billing, configure um teto mensal. É a proteção contra uma chamada em laço consumir crédito sem ninguém perceber.",
      },
    ],
  },
  {
    kind: "evolution",
    category: "produtividade",
    description:
      "Envia lembrete e confirmação de sessão pelo WhatsApp, do seu próprio número.",
    secretLabel: "API key da instância",
    secretHint: "O valor que aparece ao criar a instância",
    fields: [
      {
        key: "base_url",
        label: "URL da instância",
        hint: "Ex.: https://evolution.suaempresa.com.br",
      },
    ],
    icon: <IconSend width={19} height={19} />,
    tone: ["var(--color-success-soft)", "var(--color-success)"],
    docs: {
      label: "Documentação da Evolution API",
      url: "https://doc.evolution-api.com",
    },
    steps: [
      {
        title: "Tenha uma instância da Evolution",
        detail:
          "Contrate um provedor que hospede a Evolution API ou suba a sua (Docker). Você precisa da URL onde ela responde.",
      },
      {
        title: "Crie a instância do número",
        detail:
          "No painel da Evolution, crie uma instância e dê um nome (ex.: clinica-exemplo). Cada número de WhatsApp é uma instância.",
      },
      {
        title: "Conecte o WhatsApp",
        detail:
          "A instância mostra um QR Code. No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e leia o código. Use um número dedicado à clínica, não o pessoal.",
      },
      {
        title: "Copie a API key",
        detail:
          "A chave aparece nos detalhes da instância (apikey). Cole aqui junto com a URL do passo 1.",
      },
      {
        title: "Teste antes de confiar",
        detail:
          "Envie uma mensagem para o seu próprio número. Se o WhatsApp desconectar o aparelho, é preciso ler o QR de novo.",
      },
    ],
  },
  {
    kind: "gemini",
    category: "ia",
    description:
      "Modelo do Google. Costuma ser o mais barato para volume alto de consulta.",
    secretLabel: "Chave da API",
    secretHint: "Começa com AIza",
    icon: <IconSparkle width={19} height={19} />,
    tone: ["var(--color-info-soft)", "var(--color-info)"],
    docs: {
      label: "Google AI Studio",
      url: "https://aistudio.google.com/app/apikey",
    },
    steps: [
      {
        title: "Abra o Google AI Studio",
        detail:
          "Acesse aistudio.google.com e entre com uma conta Google. É diferente do Google Cloud Console usado na agenda.",
      },
      {
        title: "Gere a chave",
        detail:
          "Clique em “Get API key” e depois em “Create API key”. Se pedir um projeto, escolha um existente ou crie na hora.",
      },
      {
        title: "Copie o valor",
        detail:
          "A chave começa com AIza. Copie e cole aqui. Ela continua visível no painel, então dá para recuperar depois.",
      },
      {
        title: "Confira o plano",
        detail:
          "O nível gratuito tem limite de requisições por minuto. Para uso constante, ative o faturamento no projeto.",
      },
    ],
  },
  {
    kind: "deepseek",
    category: "ia",
    description:
      "Modelo chinês de custo baixo, com boa qualidade em texto e raciocínio.",
    secretLabel: "Chave da API",
    secretHint: "Começa com sk-",
    icon: <IconSparkle width={19} height={19} />,
    tone: ["var(--color-accent-soft)", "var(--color-accent-ink)"],
    docs: {
      label: "Plataforma DeepSeek",
      url: "https://platform.deepseek.com/api_keys",
    },
    steps: [
      {
        title: "Crie a conta",
        detail:
          "Acesse platform.deepseek.com e cadastre-se. Dá para entrar com e-mail ou conta Google.",
      },
      {
        title: "Adicione crédito",
        detail:
          "Em “Top up” ou “Billing”, coloque crédito. Sem saldo a chave existe mas nenhuma chamada passa.",
      },
      {
        title: "Gere a chave",
        detail:
          "Vá em “API keys” e clique em “Create new API key”. Dê um nome como CRM Exemplo EJUVV.",
      },
      {
        title: "Copie na hora",
        detail:
          "O valor aparece uma única vez. Se fechar a janela sem copiar, é preciso gerar outra chave.",
      },
    ],
  },
  {
    kind: "qwen",
    category: "ia",
    description:
      "Modelo da Alibaba. Forte em português e com opções de contexto longo.",
    secretLabel: "Chave da API",
    secretHint: "Começa com sk-",
    icon: <IconSparkle width={19} height={19} />,
    tone: ["var(--color-gold-soft)", "var(--color-gold-ink)"],
    docs: {
      label: "Alibaba Cloud Model Studio",
      url: "https://modelstudio.console.alibabacloud.com",
    },
    steps: [
      {
        title: "Crie a conta na Alibaba Cloud",
        detail:
          "Acesse modelstudio.console.alibabacloud.com e cadastre-se. O cadastro pede verificação de identidade e pode levar alguns minutos.",
      },
      {
        title: "Ative o Model Studio",
        detail:
          "No console, ative o serviço Model Studio (antigo DashScope) para a sua conta. É aqui que os modelos Qwen ficam disponíveis.",
      },
      {
        title: "Gere a API key",
        detail:
          "Em “API-KEY” ou “API Keys”, clique em criar. Guarde também a região escolhida, porque a URL da API muda conforme a região.",
      },
      {
        title: "Confira a cota gratuita",
        detail:
          "Contas novas costumam receber tokens gratuitos por modelo, com validade. Depois disso passa a cobrar por uso.",
      },
    ],
  },
  {
    kind: "kimi",
    category: "ia",
    description:
      "Modelo da Moonshot AI. Bom para documentos longos, como anamnese extensa.",
    secretLabel: "Chave da API",
    secretHint: "Começa com sk-",
    icon: <IconSparkle width={19} height={19} />,
    tone: ["var(--color-success-soft)", "var(--color-success)"],
    docs: {
      label: "Plataforma Moonshot AI",
      url: "https://platform.moonshot.ai/console/api-keys",
    },
    steps: [
      {
        title: "Crie a conta",
        detail:
          "Acesse platform.moonshot.ai e cadastre-se. Existe um painel internacional (.ai) e um chinês (.cn); use o .ai fora da China.",
      },
      {
        title: "Adicione crédito",
        detail:
          "Em “Billing”, coloque saldo. Alguns planos dão crédito inicial de teste.",
      },
      {
        title: "Gere a chave",
        detail:
          "Vá em “API Keys” → “Create”. Dê um nome que identifique o uso, como CRM Exemplo EJUVV.",
      },
      {
        title: "Copie e guarde",
        detail:
          "O valor aparece uma vez só. Cole aqui em seguida.",
      },
    ],
  },
];

export function IntegrationsSettings() {
  const { scope, revision } = useApp();
  const [items, setItems] = useState<IntegrationView[]>([]);
  const [editing, setEditing] = useState<Spec | null>(null);
  const [guide, setGuide] = useState<Spec | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    setItems(await repo.integrations.listMine(scope));
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  if (!scope) return null;

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-[14px] bg-[var(--color-warn-soft)] p-4">
        <IconAlert
          width={18}
          height={18}
          style={{ color: "var(--color-warn)" }}
          className="mt-0.5 shrink-0"
        />
        <p className="text-sm">
          <strong>Suas credenciais, só suas.</strong> Cada pessoa conecta a
          própria agenda e o próprio WhatsApp. Ninguém da equipe vê a chave de
          ninguém. Nesta versão de demonstração nada é conectado de verdade: as
          chaves ficam neste navegador para mostrar o fluxo.
        </p>
      </div>

      {(
        [
          {
            id: "produtividade",
            title: "Agenda e mensagens",
            hint: "Conecte a sua agenda e o seu número de WhatsApp.",
          },
          {
            id: "video",
            title: "Videoconsulta",
            hint: "Gera o link da sessão automaticamente junto com o agendamento e envia para a paciente. Conecte apenas o que a clínica já usa.",
          },
          {
            id: "email",
            title: "E-mail",
            hint: "Para enviar recibo, confirmação e lembrete de forma automática. Conecte um dos dois, não os dois.",
          },
          {
            id: "ia",
            title: "Modelos de IA",
            hint: "Conecte o modelo que preferir para responder pela Íris. Sem nenhum conectado, ela usa regras sobre os seus dados.",
          },
        ] as const
      ).map((group) => {
        const list = SPECS.filter((sp) => sp.category === group.id);
        return (
          <section key={group.id} className="space-y-3">
            <div>
              <h2>{group.title}</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-ink-muted)]">
                {group.hint}
              </p>
            </div>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}
            >
              {list.map((spec) => {
          const saved = items.find((i) => i.kind === spec.kind);
          return (
            <article key={spec.kind} className="card flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3.5">
                <span
                  className="icon-chip h-11 w-11"
                  style={{ background: spec.tone[0], color: spec.tone[1] }}
                  aria-hidden="true"
                >
                  {spec.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">
                    {INTEGRATION_LABELS[spec.kind]}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                    {spec.description}
                  </p>
                </div>
              </div>

              {saved ? (
                <div className="rounded-[12px] bg-[var(--color-success-soft)] px-3 py-2.5">
                  <p
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: "var(--color-success)" }}
                  >
                    <IconCheck width={13} height={13} />
                    Conectado
                  </p>
                  <p className="tabular mt-1 truncate font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                    {saved.masked}
                  </p>
                </div>
              ) : (
                <p className="rounded-[12px] bg-[var(--color-surface-2)] px-3 py-2.5 text-xs text-[var(--color-ink-muted)]">
                  Não conectado.
                </p>
              )}

              <div className="mt-auto flex gap-2 border-t border-[var(--color-line)] pt-3">
                <button
                  type="button"
                  className="btn btn-outline btn-sm flex-1"
                  onClick={() => setEditing(spec)}
                >
                  {saved ? "Trocar chave" : "Conectar"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setGuide(spec)}
                >
                  Como pegar
                </button>
              </div>

              {saved && (
                <button
                  type="button"
                  className="text-xs text-[var(--color-danger)] hover:underline"
                  onClick={async () => {
                    await repo.integrations.disconnect(scope, spec.kind);
                    load();
                  }}
                >
                  Desconectar
                </button>
              )}
            </article>
          );
        })}
            </div>
          </section>
        );
      })}

      <CredentialModal
        spec={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        onOpenGuide={(s) => { setEditing(null); setGuide(s); }}
      />

      <GuideModal spec={guide} onClose={() => setGuide(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- modais */

function CredentialModal({
  spec, onClose, onSaved, onOpenGuide,
}: {
  spec: Spec | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenGuide: (spec: Spec) => void;
}) {
  const { scope } = useApp();
  const [secret, setSecret] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (spec) { setSecret(""); setValues({}); setError(null); }
  }, [spec]);

  if (!spec || !scope) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Conectar ${INTEGRATION_LABELS[spec.kind]}`}
      description="A chave fica associada apenas à sua conta."
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm mr-auto"
            onClick={() => onOpenGuide(spec)}
          >
            Como pegar a chave
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!secret.trim()}
            onClick={async () => {
              try {
                const fields = spec.fields ?? [];
                // Um campo continua texto puro; vários viram JSON.
                const extra =
                  fields.length === 0
                    ? null
                    : fields.length === 1
                      ? values[fields[0]!.key] || null
                      : JSON.stringify(
                          Object.fromEntries(
                            fields.map((f) => [f.key, values[f.key] ?? ""]),
                          ),
                        );
                await repo.integrations.save(scope, {
                  kind: spec.kind,
                  secret,
                  extra,
                });
                onSaved();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {spec.fields?.map((field) => (
          <div key={field.key}>
            <label className="label" htmlFor={`int-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`int-${field.key}`}
              className="field"
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value }))
              }
              placeholder={field.hint}
            />
          </div>
        ))}

        <div>
          <label className="label" htmlFor="int-secret">{spec.secretLabel}</label>
          <input
            id="int-secret"
            type="password"
            className="field font-[family-name:var(--font-mono)]"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={spec.secretHint}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
            Depois de salvar, a chave aparece mascarada e não pode ser lida de
            volta, nem por você. Para trocar, cole uma nova.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function GuideModal({ spec, onClose }: { spec: Spec | null; onClose: () => void }) {
  if (!spec) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Como pegar a chave · ${INTEGRATION_LABELS[spec.kind]}`}
      description="Passo a passo, do zero."
      footer={
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Entendi
        </button>
      }
    >
      <ol className="space-y-4">
        {spec.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3.5">
            <span
              className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full font-[family-name:var(--font-mono)] text-xs font-medium"
              style={{ background: spec.tone[0], color: spec.tone[1] }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
        <p className="overline">Onde fazer isso</p>
        <a
          href={spec.docs.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-[var(--color-accent)] hover:underline"
        >
          {spec.docs.label} ↗
        </a>
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">
          Nunca compartilhe a chave por WhatsApp ou e-mail. Quem tiver o valor
          consegue usar o serviço no seu lugar. No caso do Claude, gastar o
          seu crédito.
        </p>
      </div>
    </Modal>
  );
}

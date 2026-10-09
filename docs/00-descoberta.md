# Etapa 0 — Descoberta

**Projeto:** CRM / sistema de gestão para consultório e clínica de psicologia (Tatiana)
**Data:** 17/08/2026
**Insumos analisados:** `ESCOPO_1.PDF`, `Remix of CRM SIGA SAÚDE.zip`, 16 referências
visuais, vídeo do sistema antigo (ver §5 — não analisado), Instagram da cliente.
**Notas do vault usadas:** `90 - Projetos\00-indice.md`, `meu-estilo-de-sites`,
`stack-padrao`, `regras-de-componentes`, `blueprint-fundacao`, `_template-sistema`.

---

## 1. O problema, em uma frase

Uma psicóloga que atende em consultório próprio **e** dirige uma clínica com uma equipe de
psicólogas está perdendo tempo administrando agenda, prontuário e faturamento de convênio
num sistema que ela considera ruim — e não tem visibilidade nenhuma sobre o conjunto.

O escopo da ASSEX resume o objetivo como **"organizar a rotina da clínica e otimizar o
tempo da dona"**, em três frentes: agenda, prontuário eletrônico e financeiro/faturamento.

## 2. O que o escopo oficial estabelece

Do `ESCOPO_1.PDF` (ASSEX, 11/08/2026, versão 1 — rascunho pré-transcrição):

| Item | Conteúdo |
|---|---|
| Contexto | Clínica de psicologia, múltiplos profissionais, **alto volume de pacientes** |
| Pagamento | Majoritariamente **convênio**, principal a Petrobras |
| Perfis | Dona/administradora · Psicóloga/terapeuta · Recepção/secretaria |
| Módulos | Agenda · Prontuário eletrônico · Financeiro/faturamento · Relatórios |
| RNF | LGPD e dado sensível de saúde, RBAC, escalabilidade, usabilidade |
| Fora de escopo | Portal do paciente · Telepsicologia · App nativo |

O documento é explícito em não definir tecnologia — essa decisão é nossa, e está tomada
(Next.js + TypeScript + Tailwind, §4.5 do prompt).

**Ponto a favor da cliente:** o escopo já identifica a dor certa. "Alto volume" e
"otimizar o tempo da dona" são o mesmo problema visto de dois ângulos — o gargalo é
administrativo, não clínico.

## 3. O que a conversa com o cliente acrescentou ao escopo

O sistema **também será usado pela clínica dela, com uma equipe maior de psicólogas**.
Isso não é um detalhe: transforma um app de consultório em um produto multi-tenant, e
muda cinco coisas de uma vez.

| Consequência | Por quê |
|---|---|
| `org_id` em toda entidade, desde o início | Dois contextos (consultório e clínica) no mesmo código. Retroencaixar escopo em um app já pronto é reescrita, não refactor. |
| RBAC deixa de ser enfeite | Com equipe, permissão errada é vazamento de dado clínico de terceiro, não inconveniência. |
| Sigilo entre profissionais vira decisão de produto | Ver §6 — é o ponto mais delicado do projeto. |
| Repasse por profissional | Nenhuma clínica com equipe opera sem dividir receita. O PDF não menciona. |
| Salas como recurso finito | Várias psicólogas, poucas salas: conflito de agenda é problema real. |

## 4. Auditoria do CRM de referência (`Remix of CRM SIGA SAÚDE.zip`)

Projeto Lovable: Vite + React + TypeScript + shadcn/ui + Supabase. 47 tabelas no schema,
~160 arquivos em `src/`. É um **CRM híbrido**: vendas B2B + clínica de estética. Serve
como base, mas só em parte.

### 4.1 O que aproveitar

| Origem | Valor |
|---|---|
| `src/components/health/types.ts` | Núcleo do modelo clínico: `Patient`, `Appointment`, enums de status com labels em pt-BR. Ponto de partida da Etapa 3. |
| `src/components/health/*` (14 componentes) | Prontuário, anamnese com template, termo de consentimento com assinatura, modal de pagamento, drawer de profissional. ~80% dos fluxos clínicos já pensados. |
| `src/lib/roles.ts` + `src/hooks/useDataScope.ts` | **Multi-tenant e RBAC resolvidos**: `Scope = org \| directorate \| team \| own` e whitelist de `user_ids` visíveis espelhando a RLS no client. Peça central para a clínica. |
| `src/lib/demo/*` + `demoMode.ts` | Padrão de protótipo sem backend (ver §4.3). |
| `src/pages/` | Estrutura de navegação validada (Dashboard, Agenda, Patients, Records, Financeiro, Professionals, Services, Reports, Settings, Team). |
| Tabelas transversais do schema | `organizations`, `profiles`, `user_roles`, `role_permissions`, `audit_logs`, `invitations`, `teams`, `notification_preferences`. |

### 4.2 O que descartar

- **CRM de vendas** (não é o negócio dela): `companies`, `contacts`, `pipelines`, `deals`,
  `lead_scoring_rules`, `segments`, `email_sequences`, `sales_goals`, `loss_reasons`,
  `risk_rules`, `AtRiskPanel`, `Pipeline.tsx`.
- **Estética**: `PhotosTab`, `SimulationTab`, `simulate-aesthetic` — psicologia não faz
  simulação de procedimento nem antes-e-depois.
- **Integrações e IA**: Slack, Evolution/WhatsApp API, Resend, `webhooks`, `public-api`,
  `automations`, `AICopilot`, `AIInsightsPanel`. Fase 3, se um dia.
- **Todo o `supabase/functions/`** — não há backend nesta fase.
- **O visual inteiro** — shadcn com badges `bg-blue-100`/`emerald`: paleta genérica de
  template, o oposto do que o vault pede.

### 4.3 Três armadilhas encontradas no zip

**Armadilha 1 — o schema não tem o modelo clínico.**
`.lovable/consolidated_schema.sql` tem 47 tabelas e **nenhuma delas é `patients`,
`appointments` ou `medical_records`**. É o schema do CRM de vendas. O módulo de saúde
existe só no front, tipado em `src/components/health/types.ts`. Quem confiar no SQL conclui
que não há modelo clínico; quem ignorar o SQL perde as tabelas transversais que servem.
→ *O modelo clínico precisa ser escrito por nós na Etapa 3.*

**Armadilha 2 — o modo demo é bom, mas tem três defeitos.**
`src/lib/demo/client.ts` é uma fachada compatível com a API do Supabase
(`.from().select().eq()…`) que responde de dados locais, permitindo trocar a fonte de
dados sem tocar em componente. A ideia é boa. Os defeitos:

1. **Só em memória** — recarregou a página, perdeu tudo. Aqui precisa persistir.
2. **Reimplementa o DSL do PostgREST** (~11 KB de parser de operadores: `eq`, `ilike`,
   `cs`, `ov`…). Custo de manutenção alto para o que entrega.
3. **IDs com `Math.random()`** — não determinístico, atrapalha teste e seed.

→ *Adotamos a interface de repositório (Etapa 4), não a fachada.*

**Armadilha 3 — `canManagePacientes` mistura duas permissões.**
Em `src/lib/roles.ts`, `canManagePacientes` libera `owner/admin/director/manager` de uma
vez. **Gerenciar cadastro** e **ler evolução clínica** são coisas diferentes, e em
psicologia a segunda esbarra em sigilo profissional. Precisam ser duas permissões
separadas. Ver §6.

## 5. O sistema antigo — PENDÊNCIA BLOQUEANTE PARCIAL

`WhatsApp Video 2026-08-10 at 17.27.40.mp4` (1,6 MB) mostra o sistema que a cliente
considera ruim. **Não foi analisado**: não há `ffmpeg` no ambiente para extrair frames, e o
formato não é legível diretamente.

O escopo lista como pendência geral *"reclamações específicas sobre o sistema atual"* — ou
seja, essa informação não existe em lugar nenhum ainda, nem no PDF.

> **Não vamos supor.** Sem isso, corremos o risco de reproduzir exatamente as dores que
> motivaram a troca. Duas saídas, em ordem de preferência:
> 1. Assistir ao vídeo e listar as dores concretas (5 minutos de trabalho manual);
> 2. Perguntar à cliente: *"o que você mais perde tempo fazendo no sistema de hoje?"*
>
> Enquanto isso não chega, as decisões de UX seguem por hipótese declarada (§7), não por
> achismo silencioso.

## 6. A questão de sigilo — o ponto mais delicado do projeto

O escopo deixa em aberto: *"acesso restrito ao profissional responsável (e à dona,
conforme permissão a confirmar)"*. Com uma psicóloga sozinha, isso é irrelevante. Com uma
equipe, é a decisão central do produto.

Em psicologia, o conteúdo da sessão é protegido por sigilo profissional, e o vínculo é
entre **a psicóloga e o paciente** — não entre a clínica e o paciente. A dona da clínica
ser administradora do sistema não faz dela destinatária do conteúdo clínico das colegas.

**Regra proposta — a implementar e validar com a cliente antes do aceite:**

| Quem | Vê que houve sessão, data, presença, valor, responsável | Vê o conteúdo da evolução |
|---|---|---|
| Psicóloga responsável | sim | sim |
| Dona / administradora | sim | **não, por padrão** |
| Recepção | sim (sem valor clínico) | não |

O acesso da dona ao conteúdo existe como **ação excepcional e explícita**: exige motivo
escrito, grava na trilha de auditoria e **notifica a profissional responsável**. Nunca
silencioso.

> **Isso é também diferencial comercial.** Nenhum CRM genérico de saúde faz essa
> distinção — o zip de referência não faz. É precisamente o que separa um sistema de
> clínica de estética de um sistema de psicologia, e é um argumento forte na venda.

**A decisão final é da cliente**, com respaldo do conselho profissional dela. Nosso papel é
apresentar a regra, implementá-la como default e deixá-la configurável.

## 7. Hipóteses declaradas (na falta das respostas)

Toda hipótese abaixo vira pergunta na §9. Enquanto não houver resposta, o sistema é
construído assim — e isso está registrado, não escondido.

| # | Hipótese | Risco se errada |
|---|---|---|
| H1 | Clínica com 6–8 psicólogas, consultório com 1 | Baixo — o modelo escala nos dois sentidos |
| H2 | Existe atendimento particular além do convênio | Baixo — modelar os dois é barato agora |
| H3 | Há repasse por profissional (% sobre a sessão) | **Alto** — muda o financeiro inteiro |
| H4 | Salas são recurso limitado e geram conflito | Médio — se não for, o campo fica ocioso |
| H5 | Lembrete ao paciente será por WhatsApp | Médio — no protótipo é simulado de qualquer forma |
| H6 | TISS fica para a v2 | Médio — é o item mais caro do escopo |

## 8. Referências visuais — o que extrair

16 capturas de dashboards (majoritariamente do perfil `@codez_dev`). São referência de
**layout e hierarquia**, não de paleta — as cores delas (verde neon, roxo saturado,
laranja sobre dark) vão contra o DNA do vault.

Denominador comum das 16:

- **Shell com sidebar** agrupada por seção (menu principal / cadastros / gestão / ajustes);
  duas delas usam top-nav em pill.
- **Faixa de 3–4 KPIs** no topo, cada card com valor grande, label pequeno e delta vs.
  período anterior.
- **Um card de gráfico dominante** + cards satélites menores.
- **Tabela ou lista embaixo**, com avatar, badge de status com dot colorido e valor à direita.
- **Cantos muito arredondados** (16–24 px), sombra suave e difusa, superfície branca sobre
  fundo levemente tonalizado.
- **Um acento forte único** por design — nunca dois competindo. Coincide com a regra do
  vault (`meu-estilo-de-sites`: "um acento terroso ou metálico, nada de dois acentos").
- Toggle segmentado para período (Diário/Mensal/Anual), botão primário em pill.

→ *Aproveitamos a estrutura; a paleta vem da §7 do prompt (rosé + dourado sobre neutros
quentes).*

## 9. Perguntas abertas

Ordenadas por impacto no que vamos construir.

| # | Pergunta | Bloqueia | Origem |
|---|---|---|---|
| 1 | A dona pode ler a evolução clínica das colegas? (ver §6) | Etapa 3 e 7 | PDF §4 + equipe |
| 2 | Existe repasse por profissional? % fixo, por serviço ou por convênio? | Etapa 3 | Equipe (H3) |
| 3 | As psicólogas são CLT, PJ ou autônomas? | Etapa 3 | Decorre da 2 |
| 4 | Quais dores específicas do sistema atual? | UX de todos os módulos | PDF §9 + vídeo |
| 5 | Há atendimento particular além do convênio? | Etapa 3 | PDF §5 |
| 6 | Quais convênios além da Petrobras, e regras por operadora? | Etapa 3 | PDF §5 |
| 7 | TISS entra na v1 ou v2? | Roadmap e orçamento | PDF §5 |
| 8 | A recepção pode ver que existe prontuário, ou nem isso? | Etapa 3 | PDF §2 |
| 9 | Quantas salas a clínica tem? | Etapa 3 | Equipe (H4) |
| 10 | Volume real: quantos pacientes e atendimentos por mês? | Dimensionamento | PDF §9 |
| 11 | Canal do lembrete: WhatsApp, SMS ou e-mail? | Fase 2 | PDF §3 |
| 12 | Prazo e orçamento | Roadmap | PDF §9 |

**Nenhuma delas impede começar.** As de maior impacto (1, 2, 4) afetam Etapas 3 e 7 — há
trabalho suficiente nas Etapas 1 e 2 enquanto as respostas não chegam.

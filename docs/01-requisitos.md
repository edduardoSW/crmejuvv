# Etapa 1 — Requisitos

**Base:** `ESCOPO_1.PDF` (ASSEX, 11/08/2026) + escopo multi-clínica confirmado com o
cliente + auditoria do CRM de referência (`docs/00-descoberta.md`).

Convenções: **[P]** protótipo (esta entrega, localStorage) · **[F2]** fase 2 (backend) ·
**[V2]** versão futura. Prioridade em MoSCoW: **M** must · **S** should · **C** could ·
**W** won't (nesta fase).

---

## 1. Personas

| Persona | Quem é | Usa para | Dor principal |
|---|---|---|---|
| **Tatiana — dona** | Psicóloga, atende E administra a clínica | Ver o todo: ocupação, faturamento, faltas; atender os próprios pacientes | Perde tempo em administração; não tem visão consolidada |
| **Psicóloga da equipe** | Atende na clínica | Própria agenda e prontuário dos próprios pacientes | Registro de evolução tem de ser rápido — é feito entre sessões |
| **Recepção** | Apoio administrativo | Marcar, remarcar, confirmar, encaixar; lançar pagamento | Volume alto de remarcação; precisa ver todas as agendas de uma vez |

Não há acesso de paciente ao sistema nesta fase (PDF §2 e §8).

## 2. Jobs to be done

1. *Quando um paciente liga para remarcar, quero achar o horário livre da psicóloga dele em
   segundos, para não deixar o paciente esperando no telefone.*
2. *Quando termino uma sessão, quero registrar a evolução em menos de um minuto, para não
   acumular pendência no fim do dia.*
3. *Quando fecha o mês, quero saber quanto cada convênio deve, para cobrar sem depender de
   planilha.*
4. *Quando olho a clínica, quero ver ocupação e falta por profissional, para decidir agenda
   e equipe.*

## 3. Requisitos funcionais

### RF-01 · Autenticação e organização

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-01.1 | Seletor de perfil (dona / psicóloga / recepção) simulando login | M | P |
| RF-01.2 | Seletor de organização quando o usuário pertence a mais de uma | M | P |
| RF-01.3 | Todo dado é filtrado por `org_id`; trocar de organização não revela registro de outra | M | P |
| RF-01.4 | Login real com e-mail e senha, recuperação de senha | M | F2 |
| RF-01.5 | Convite de profissional por e-mail | S | F2 |

### RF-02 · Agenda

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-02.1 | Visão dia e semana da agenda de uma profissional | M | P |
| RF-02.2 | Grade consolidada com todas as profissionais lado a lado | M | P |
| RF-02.3 | Agendar sessão vinculada a paciente, profissional, serviço, data/hora e sala | M | P |
| RF-02.4 | Remarcar por arrastar ou por formulário, preservando histórico da remarcação | M | P |
| RF-02.5 | Cancelar com motivo | M | P |
| RF-02.6 | Encaixe fora da grade padrão, com marcação visual | S | P |
| RF-02.7 | Bloquear horário (folga, almoço, indisponibilidade), pontual ou recorrente | M | P |
| RF-02.8 | Status da sessão: agendada, confirmada, atendida, falta, cancelada | M | P |
| RF-02.9 | Impedir conflito: mesma profissional, mesma sala ou mesmo paciente no mesmo horário | M | P |
| RF-02.10 | Marcar "lembrete enviado" e exibir preview da mensagem (simulado) | M | P |
| RF-02.11 | Envio real de lembrete por WhatsApp | M | F2 |
| RF-02.12 | Confirmação do paciente pelo próprio lembrete | S | F2 |
| RF-02.13 | Sessões recorrentes (mesmo horário toda semana) | S | P |
| RF-02.14 | Lista de espera para vaga que abrir | C | V2 |

### RF-03 · Pacientes

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-03.1 | Cadastro: nome, contato, CPF, nascimento, endereço, contato de emergência | M | P |
| RF-03.2 | Vínculo com convênio (operadora, número da carteirinha) ou particular | M | P |
| RF-03.3 | Profissional responsável | M | P |
| RF-03.4 | Busca por nome, telefone ou CPF, com filtros por profissional, convênio e status | M | P |
| RF-03.5 | Ficha com linha do tempo unificada (sessões, documentos, pagamentos) | M | P |
| RF-03.6 | Contador de faltas visível | S | P |
| RF-03.7 | Status ativo / inativo, sem exclusão de paciente com histórico | M | P |
| RF-03.8 | Transferência de paciente entre profissionais, com registro | S | P |

### RF-04 · Prontuário eletrônico

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-04.1 | Registro de evolução por sessão, vinculado a paciente e data/hora | M | P |
| RF-04.2 | Template de evolução configurável (texto livre e campos estruturados) | S | P |
| RF-04.3 | Anamnese com template editável | M | P |
| RF-04.4 | Termo de consentimento com assinatura em tela | S | P |
| RF-04.5 | Anexo de documentos (laudo, atestado, encaminhamento) | M | P |
| RF-04.6 | Histórico cronológico completo do paciente | M | P |
| RF-04.7 | **Acesso ao conteúdo restrito à profissional responsável** | M | P |
| RF-04.8 | **Dona vê metadados da sessão, não o conteúdo da evolução** | M | P |
| RF-04.9 | **Acesso justificado: motivo escrito obrigatório, auditado e notificado** | M | P |
| RF-04.10 | Recepção não acessa conteúdo clínico | M | P |
| RF-04.11 | Evolução assinada fica travada para edição; correção vira adendo datado | S | P |
| RF-04.12 | Trilha de auditoria de todo acesso e alteração | M | P |
| RF-04.13 | Exportar prontuário do paciente em PDF | C | V2 |

> RF-04.8 e RF-04.9 dependem da resposta à pergunta 1 de `00-descoberta.md §9`. Construídos
> como default; configuráveis.

### RF-05 · Financeiro

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-05.1 | Sessão marcada como atendida gera lançamento automaticamente | M | P |
| RF-05.2 | Lançamento com origem: convênio ou particular | M | P |
| RF-05.3 | Status do faturamento: previsto, faturado, recebido, glosado | M | P |
| RF-05.4 | Painel por convênio: o que cada operadora deve e já pagou | M | P |
| RF-05.5 | Registro de pagamento particular (dinheiro, PIX, cartão) | M | P |
| RF-05.6 | Tabela de valores por serviço e por convênio | M | P |
| RF-05.7 | **Regra de repasse por profissional** (% ou valor fixo, distinto por convênio) | S | P |
| RF-05.8 | **Fechamento mensal por profissional** com total a repassar | S | P |
| RF-05.9 | Exportação CSV de lançamentos e do fechamento | M | P |
| RF-05.10 | Registro e reapresentação de glosa | C | V2 |
| RF-05.11 | Geração de guia TISS | C | V2 |
| RF-05.12 | Conciliação bancária | W | — |

> RF-05.7 e RF-05.8 dependem das perguntas 2 e 3 de `00-descoberta.md §9`.

### RF-06 · Relatórios

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-06.1 | Volume de atendimentos por período | M | P |
| RF-06.2 | Faturamento por convênio | M | P |
| RF-06.3 | Taxa de faltas e cancelamentos | M | P |
| RF-06.4 | Ocupação da agenda por profissional | M | P |
| RF-06.5 | Todo relatório com recorte por profissional **e** consolidado da clínica | M | P |
| RF-06.6 | Filtro por período com comparativo vs. período anterior | S | P |
| RF-06.7 | Exportação CSV | S | P |

### RF-07 · Equipe e configurações

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-07.1 | Cadastro de profissional (nome, CRP, especialidade, agenda padrão) | M | P |
| RF-07.2 | Papéis e matriz de permissões visível e editável | M | P |
| RF-07.3 | **Desligar profissional com transferência de responsabilidade** sobre pacientes e prontuários; nunca exclusão | M | P |
| RF-07.4 | Cadastro de convênios e regras por operadora | M | P |
| RF-07.5 | Serviços e valores | M | P |
| RF-07.6 | Salas | S | P |
| RF-07.7 | Templates de evolução, anamnese e consentimento | S | P |
| RF-07.8 | **Tela de auditoria consultável pela dona** (quem acessou o quê, quando, por quê) | M | P |
| RF-07.9 | Restaurar dados de demonstração | M | P |

### RF-08 · Dashboard

| ID | Requisito | MoSCoW | Fase |
|---|---|---|---|
| RF-08.1 | Atendimentos do dia da usuária logada | M | P |
| RF-08.2 | KPIs: atendimentos no mês, faturamento, taxa de faltas, ocupação | M | P |
| RF-08.3 | Próximas sessões | M | P |
| RF-08.4 | Pendências: evolução não registrada, lembrete não enviado, glosa em aberto | S | P |
| RF-08.5 | Conteúdo do dashboard muda conforme o perfil | M | P |

## 4. Requisitos não funcionais

| ID | Requisito | Como se verifica | Fase |
|---|---|---|---|
| RNF-01 | Nenhum componente acessa `localStorage` direto; tudo via repositório | Busca por `localStorage` fora de `lib/repository/` retorna zero | P |
| RNF-02 | A interface do repositório tem a mesma assinatura do contrato de API da Etapa 4 | Revisão cruzada dos dois documentos | P |
| RNF-03 | Nenhuma leitura sem `orgId` no escopo | Teste: trocar de organização não vaza registro | P |
| RNF-04 | Dado clínico real nunca entra no protótipo; banner permanente de demonstração | Inspeção visual | P |
| RNF-05 | Acessibilidade: contraste AA, navegação por teclado nos fluxos críticos, `:focus-visible`, `aria-label` em pt-BR | Checklist da Etapa 8 | P |
| RNF-06 | Responsivo em 375 / 768 / 1440 — a recepção usa tablet | Teste nos três tamanhos | P |
| RNF-07 | Respeitar `prefers-reduced-motion` | Inspeção | P |
| RNF-08 | Seed determinístico (PRNG com semente); mesma base a cada restauração | Duas restaurações produzem dados idênticos | P |
| RNF-09 | Schema versionado no storage com rotina de migração | Inspeção | P |
| RNF-10 | Limite de tamanho por anexo, com aviso — localStorage tem ~5 MB | Teste de estouro | P |
| RNF-11 | Agenda com 1.200 sessões navega sem travar | Medição com o seed cheio | P |
| RNF-12 | Criptografia em repouso e em trânsito | — | F2 |
| RNF-13 | RLS reproduzindo exatamente a regra de sigilo, inclusive o acesso justificado | Teste de política por papel | F2 |
| RNF-14 | Política de retenção e base legal LGPD documentadas | Etapa 7 | F2 |
| RNF-15 | Backup automatizado com restauração testada | — | F2 |

## 5. Fora de escopo

**Nesta fase (PDF §8):** portal ou acesso do paciente · telepsicologia · app mobile nativo.

**Neste protótipo, além do acima:** backend e banco · autenticação real · envio real de
lembrete · geração de guia TISS · integrações (Slack, e-mail, WhatsApp API) · qualquer
recurso de IA · conciliação bancária · nota fiscal.

## 6. Critérios de aceite dos fluxos críticos

**CA-01 · Agendar sessão**
Dado que sou recepção e o paciente pede horário com a psicóloga X na terça às 14h,
quando escolho profissional, paciente, serviço, sala e horário,
então a sessão é criada com status "agendada", aparece nas duas visões de agenda, e o
sistema recusa a marcação se a profissional, a sala ou o paciente já estiverem ocupados
naquele horário — informando qual dos três conflitou.

**CA-02 · Registrar evolução**
Dado que sou a psicóloga responsável e a sessão está marcada como atendida,
quando abro a sessão e escrevo a evolução,
então ela é salva vinculada ao paciente e à data/hora, aparece na linha do tempo, e o
acesso fica registrado na auditoria.

**CA-03 · Sigilo**
Dado que sou a dona e a sessão é de outra psicóloga,
quando abro a sessão,
então vejo data, duração, presença, valor e responsável, **e não vejo o conteúdo**; existe
a ação "acessar com justificativa", que exige motivo escrito, e ao usá-la o acesso é
gravado na auditoria e a profissional responsável é notificada.

**CA-04 · Faturar convênio**
Dado que existem sessões atendidas de pacientes da Petrobras no mês,
quando abro o financeiro filtrado por essa operadora,
então vejo o total previsto, o que foi faturado e o que já foi recebido, com a lista das
sessões que compõem cada valor, e consigo exportar em CSV.

**CA-05 · Desligar profissional**
Dado que uma psicóloga sai da clínica,
quando a desligo e escolho a responsável que assume seus pacientes,
então ela perde o acesso, nenhum prontuário é apagado, os pacientes passam à nova
responsável e a transferência fica registrada na auditoria.

**CA-06 · Trocar de organização**
Dado que pertenço ao consultório e à clínica,
quando troco de organização no header,
então todos os módulos passam a mostrar somente dados daquela organização, sem exceção.

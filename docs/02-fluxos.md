# Etapa 2 — Arquitetura da informação e fluxos

**Base:** `docs/00-descoberta.md` e `docs/01-requisitos.md`.

---

## 1. Sitemap

```mermaid
graph LR
  R["/ (app)"] --> D["/dashboard"]
  R --> A["/agenda"]
  R --> P["/pacientes"]
  R --> PR["/prontuarios"]
  R --> F["/financeiro"]
  R --> RE["/relatorios"]
  R --> E["/equipe"]
  R --> C["/configuracoes"]

  A --> A1["/agenda?view=dia|semana"]
  A --> A2["/agenda/consolidada"]
  P --> P1["/pacientes/:id"]
  P1 --> P2["/pacientes/:id/prontuario"]
  P1 --> P3["/pacientes/:id/financeiro"]
  F --> F1["/financeiro/convenios"]
  F --> F2["/financeiro/repasses"]
  E --> E1["/equipe/:id"]
  C --> C1["/configuracoes/permissoes"]
  C --> C2["/configuracoes/convenios"]
  C --> C3["/configuracoes/servicos"]
  C --> C4["/configuracoes/salas"]
  C --> C5["/configuracoes/templates"]
  C --> C6["/configuracoes/auditoria"]
  C --> C7["/configuracoes/demonstracao"]
```

Rotas em português — é sistema de uso interno, em pt-BR (regra do vault: textos em pt-BR,
código em en-US).

## 2. Navegação por perfil

A sidebar não mostra o que o perfil não pode usar. Esconder e bloquear, nunca só bloquear.

| Item | Dona | Psicóloga | Recepção |
|---|---|---|---|
| Dashboard | ✓ (clínica) | ✓ (própria) | ✓ (operacional do dia) |
| Agenda | ✓ todas | ✓ própria | ✓ todas |
| Pacientes | ✓ todos | ✓ próprios | ✓ todos (cadastro) |
| Prontuários | ✓ metadados | ✓ próprios | ✗ |
| Financeiro | ✓ total | ✓ próprios repasses | ✓ lançamentos |
| Relatórios | ✓ consolidado | ✓ próprios | ✗ |
| Equipe | ✓ | ✗ | ✗ |
| Configurações | ✓ | ✗ | ✗ |
| Auditoria | ✓ | ✗ | ✗ |

## 3. Shell da aplicação

Derivado das 16 referências (`00-descoberta.md §8`), com a paleta do vault:

```
┌──────────────────────────────────────────────────────────────────┐
│ [logo]  Clínica ▾ │  busca…              🔔  [perfil: Dona ▾] │  ← header
├───────────┬──────────────────────────────────────────────────────┤
│ ATENDIMENTO│  Dashboard                                          │
│  Dashboard │  ─────────────                                      │
│  Agenda    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐   ← faixa de 4 KPIs   │
│  Pacientes │  └────┘ └────┘ └────┘ └────┘                        │
│  Prontuário│  ┌──────────────────┐ ┌─────────┐                   │
│            │  │ gráfico dominante│ │satélites│                   │
│ GESTÃO     │  └──────────────────┘ └─────────┘                   │
│  Financeiro│  ┌──────────────────────────────┐                   │
│  Relatórios│  │ tabela / lista               │                   │
│  Equipe    │  └──────────────────────────────┘                   │
│            │                                                     │
│ AJUSTES    │                                                     │
│  Config.   │                                                     │
└───────────┴──────────────────────────────────────────────────────┘
```

Em ≤768 px a sidebar vira bottom nav com os 4 itens principais do perfil; o resto entra em
"Mais".

## 4. Fluxos críticos

### 4.1 Agendar sessão (CA-01)

```mermaid
flowchart TD
  A[Recepção abre Agenda] --> B{Paciente existe?}
  B -- não --> C[Cadastro rápido: nome, telefone, convênio]
  C --> D
  B -- sim --> D[Escolhe profissional, serviço, data/hora, sala]
  D --> E{Conflito?}
  E -- profissional ocupada --> E1[Recusa e mostra o horário livre mais próximo]
  E -- sala ocupada --> E2[Recusa e sugere outra sala]
  E -- paciente já tem sessão --> E3[Recusa e mostra a sessão existente]
  E -- livre --> F{Fora da grade padrão?}
  F -- sim --> G[Marca como encaixe]
  F -- não --> H[Sessão status = agendada]
  G --> H
  H --> I[Aparece nas duas visões de agenda]
  I --> J[Lembrete fica pendente de envio]
  E1 --> D
  E2 --> D
  E3 --> D
```

A checagem de conflito é tripla — profissional, sala e paciente — e a mensagem diz **qual**
dos três conflitou. Erro genérico aqui custa tempo de telefone.

### 4.2 Registrar evolução (CA-02)

```mermaid
flowchart TD
  A[Psicóloga abre a sessão do dia] --> B{Status}
  B -- agendada --> C[Marca presença: atendida / falta]
  C --> D{Atendida?}
  D -- não --> E[Falta: incrementa contador, gera regra de cobrança se houver]
  D -- sim --> F[Abre editor de evolução]
  F --> G[Template do serviço pré-carregado]
  G --> H[Escreve e salva]
  H --> I[Vincula a paciente + data/hora]
  I --> J[Entra na linha do tempo]
  J --> K[Grava acesso na auditoria]
  H --> L{Assinar?}
  L -- sim --> M[Trava edição; correção só por adendo datado]
  E --> N[Sessão realizada gera lançamento financeiro]
  D -- sim --> N
```

O caminho de sucesso — presença, evolução, salvar — cabe em três interações. É o fluxo mais
repetido do sistema (JTBD 2).

### 4.3 Acesso da dona a prontuário de terceiro (CA-03)

```mermaid
flowchart TD
  A[Dona abre a sessão de paciente de outra psicóloga] --> B[Vê metadados: data, duração, presença, valor, responsável]
  B --> C{Precisa do conteúdo?}
  C -- não --> D[Fim: nenhum acesso clínico registrado]
  C -- sim --> E["Ação: acessar com justificativa"]
  E --> F[Motivo escrito obrigatório]
  F --> G{Motivo preenchido?}
  G -- não --> E
  G -- sim --> H[Conteúdo liberado por tempo limitado]
  H --> I[Auditoria: quem, quando, qual prontuário, por quê]
  I --> J[Notifica a profissional responsável]
```

Ponto de fricção **deliberado**. A fricção é o produto: torna o acesso raro, rastreável e
consciente.

### 4.4 Faturar convênio e fechar o mês (CA-04)

```mermaid
flowchart TD
  A[Sessão marcada como atendida] --> B[Lançamento: valor da tabela do convênio]
  B --> C[Status = previsto]
  C --> D[Fechamento do período por operadora]
  D --> E[Lote de faturamento: status = faturado]
  E --> F{Operadora pagou?}
  F -- integral --> G[Status = recebido]
  F -- parcial ou zero --> H[Status = glosado, com motivo]
  H --> I["Reapresentação (V2)"]
  G --> J[Entra no fechamento do mês]
  H --> J
  J --> K[Cálculo de repasse por profissional]
  K --> L[Exporta CSV]
```

O elo `sessão → lançamento` é o que o PDF pede em §5 (*"vínculo entre sessão realizada e
lançamento financeiro"*) e é o que quebra na planilha de hoje.

### 4.5 Remarcar (fluxo de maior volume)

```mermaid
flowchart TD
  A[Paciente liga] --> B[Busca por nome ou telefone]
  B --> C[Abre a próxima sessão dele]
  C --> D{O que fazer?}
  D -- remarcar --> E[Escolhe novo horário na agenda da mesma profissional]
  E --> F{Conflito?}
  F -- sim --> E
  F -- não --> G[Move a sessão, mantém histórico do horário anterior]
  D -- cancelar --> H[Motivo obrigatório]
  H --> I[Libera o horário; sinaliza vaga aberta]
  G --> J[Lembrete volta a pendente]
```

Do atendimento ao telefone até a sessão movida: **três telas, no máximo**. Se passar disso,
o sistema falhou no JTBD 1.

## 5. Estados que todo módulo precisa ter

Não são detalhe de acabamento — são o que separa protótipo apresentável de tela quebrada
na reunião.

| Estado | Tratamento |
|---|---|
| Carregando | Skeleton com a forma do conteúdo, nunca spinner solto |
| Vazio por não haver dado | Ilustração leve + o que fazer + botão da ação principal |
| Vazio por filtro | "Nenhum resultado para X" + limpar filtro |
| Sem permissão | Não renderiza; se a rota for acessada direto, tela explicando qual perfil tem acesso |
| Erro | Mensagem em pt-BR, o que aconteceu e o que fazer; nunca stack trace |
| Conflito de agenda | Inline, ao lado do campo, dizendo qual recurso conflitou |
| Ação destrutiva | Confirmação nomeando o que será afetado ("desligar Ana: 23 pacientes passam para…") |

## 6. Onde o protótipo simula

Registrado aqui e repetido no README (regra: nada de mock silencioso).

| Simulado | Como aparece na UI |
|---|---|
| Login | Seletor de perfil no header, rotulado "modo demonstração" |
| Lembrete ao paciente | Botão "enviar" marca como enviado e abre preview da mensagem, com aviso de que nada é enviado |
| Notificação à profissional (acesso justificado) | Entra na tela de notificações interna |
| Assinatura do termo | Desenho em canvas, salvo como imagem — sem validade jurídica |
| Anexos | Base64 no localStorage, com limite de tamanho e aviso |
| Exportação CSV | Real, gerada no client |

## 7. O que ainda não dá para desenhar

Dependem das respostas de `00-descoberta.md §9`:

- **Tela de repasse** (perguntas 2 e 3) — a estrutura muda se for % fixo, por serviço ou
  por convênio, e se as psicólogas são CLT, PJ ou autônomas.
- **Fluxo de guia TISS** (pergunta 7) — se entrar na v1, vira um módulo inteiro.
- **Ajustes de UX guiados pelas dores do sistema atual** (pergunta 4, vídeo não analisado).

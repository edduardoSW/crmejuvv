# CRM Exemplo · EJUVV

Protótipo de sistema de gestão para consultório de psicologia: agenda,
prontuário eletrônico, financeiro por convênio, tarefas e relatórios.

**Esta versão roda inteira no navegador.** Não há backend, banco de dados nem
autenticação real: os dados ficam em `localStorage` e são fictícios. O objetivo
é validar fluxos e interface com a cliente antes de construir a fase 2.

---

## Rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. Na tela de login, qualquer senha entra
(`demo@ejuvv.com`).

A base de demonstração tem 120 pacientes e cerca de 1.300 sessões em seis
meses, com faltas, cancelamentos e encaixes realistas, para os gráficos e
relatórios terem o que mostrar.

## Stack

Verificada no registro npm em 17/08/2026, conforme a política de usar sempre a
última estável.

| Camada | Escolha |
|---|---|
| Framework | Next.js 16.3.1, App Router |
| Linguagem | TypeScript 7.0.2 |
| Estilo | Tailwind CSS 4.3.3, configuração CSS-first (`@theme`) |
| UI | Componentes próprios. Sem shadcn, sem Radix, sem biblioteca de ícones |
| Gráficos | SVG escrito à mão |
| Persistência | `localStorage`, atrás de uma camada de repositório |

## Como o código está organizado

```
src/
├── app/
│   ├── (app)/            # telas autenticadas
│   └── login/
├── components/
│   ├── layout/           # shell, navegação
│   ├── ui/               # Modal, Select, Charts, Avatar, Pagination…
│   ├── patients/ records/ finance/ settings/
│   └── icons/            # SVG próprio
└── lib/
    ├── domain/types.ts   # modelo de domínio
    ├── repository/       # ÚNICO caminho para dados
    │   ├── contract.ts   # a interface
    │   ├── store.ts      # único arquivo que toca localStorage
    │   └── local/        # implementação do protótipo
    ├── seed.ts           # base fictícia determinística
    └── insights.ts       # "recados da Íris"
```

### A regra que sustenta a migração

Nenhum componente acessa `localStorage`. Tudo passa por
`lib/repository/`, cuja interface é **a mesma** do contrato de API descrito em
[`docs/04-contrato-api.md`](docs/04-contrato-api.md). Trocar o protótipo por
Supabase é implementar `repository/supabase/` e mudar uma linha em
`repository/index.ts`.

Toda função de repositório recebe um `Scope` como primeiro argumento
(`org_id`, `profile_id`, papel, whitelist de profissionais). É o mesmo filtro
que a RLS vai aplicar na fase 2: regra errada aqui vira brecha de segurança lá.

## Decisões que valem conhecer

**A interface é de consultório individual; o modelo não é.** Toda entidade
carrega `org_id`, os papéis (dona, psicóloga, recepção) e as permissões
continuam no código, e o `Scope` que cada função de repositório recebe é o
mesmo. O que muda é só a apresentação: `isSolo`, em
`components/providers/AppProvider.tsx`, esconde tudo o que só faz sentido com
equipe — filtro por profissional, escolha de responsável, repasse,
compartilhamento de evolução e a aba de equipe. **Cadastrar uma segunda pessoa
faz esses pontos reaparecerem sozinhos**, sem tocar em código.

Retroencaixar multi-tenant depois seria reescrita; esconder é uma linha.

**Prontuário é privado da autora.** Cada profissional vê apenas as próprias
evoluções. Para outra pessoa ler, a autora compartilha explicitamente, e pode
revogar. Não existe permissão de "ler de todos". Quem cuida de agenda e
faturamento continua vendo metadados (que houve sessão, data, presença,
valor), nunca o conteúdo.

**A Íris responde por regras, não por modelo.** Os "recados" e o chat são
gerados por regras sobre os dados reais da base. É proposital: mostra o formato
e o valor que a IA entregaria, sem custo de API e sem risco de inventar número
numa apresentação. Conectar um modelo de verdade troca uma função só.

**Extrato não vira lançamento sozinho.** A importação de CSV e OFX cria linhas
de extrato que precisam ser conciliadas com um lançamento existente. Extrato
traz aluguel e tarifa junto com receita; importar tudo inflaria o faturamento.

**PDF não é lido automaticamente.** Cada banco monta o arquivo de um jeito e o
risco de importar valor errado é alto. O sistema pede CSV ou OFX.

## O que é simulado

| Simulado | Como aparece |
|---|---|
| Login | Qualquer senha entra; aviso na tela |
| Lembrete ao paciente | Marca como enviado e mostra a prévia da mensagem |
| Integrações | As chaves são guardadas, mas nada é conectado de verdade |
| Assinatura do termo | Desenho em canvas, sem validade jurídica |
| Anexos | Base64 no navegador, com limite por arquivo |

Exportação de CSV e importação de extrato são reais.

## Limitações conhecidas

- `localStorage` tem cerca de 5 MB. A base de demonstração ocupa cerca de
  2 MB; se o navegador recusar a gravação, o seed encolhe o histórico sozinho.
  Anexos têm teto por arquivo.
- Dados ficam em um único navegador. Trocar de máquina começa do zero.
- Sem backup. "Recriar os dados de demonstração", no login, restaura a base.
- **Não use com dados reais de pacientes.**

## Documentação

A esteira completa do projeto está em [`docs/`](docs/):

| Documento | Conteúdo |
|---|---|
| [00-descoberta.md](docs/00-descoberta.md) | Dores, auditoria do sistema de referência, perguntas abertas |
| [01-requisitos.md](docs/01-requisitos.md) | Requisitos funcionais e não funcionais, critérios de aceite |
| [02-fluxos.md](docs/02-fluxos.md) | Sitemap, navegação por perfil, fluxos críticos |
| [03-modelo-de-dados.md](docs/03-modelo-de-dados.md) | ERD, dicionário de dados, DDL da fase 2 |
| [04-contrato-api.md](docs/04-contrato-api.md) | A interface que o repositório implementa |
| [05-design-system.md](docs/05-design-system.md) | Tokens, componentes, acessibilidade |

O material do cliente (escopo em PDF, referências visuais, gravação do sistema
antigo) fica em `material-cliente/`, fora do controle de versão.

## Próxima fase

Supabase com autenticação real, RLS reproduzindo as regras de acesso deste
protótipo, credenciais de integração num cofre no servidor, e migração dos
dados do navegador para o banco.

Se um dia a operação virar clínica com equipe, nada do modelo precisa mudar:
basta cadastrar as profissionais.

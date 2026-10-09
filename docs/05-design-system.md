# Etapa 5 — Design system

**Base:** `meu-estilo-de-sites` e `regras-de-componentes` do vault + as 16 referências
(`00-descoberta.md §8`) + a paleta rosé/dourado pedida pela cliente.

**Stack:** Tailwind CSS 4.3.3 com configuração **CSS-first** (`@theme`), sem
`tailwind.config.js`. Tokens vivem em `src/app/globals.css`.

---

## 1. Princípio

O vault manda **neutros quentes + um acento**. A cliente pediu **rosé e dourado**. Não é
contradição se os dois tiverem papéis diferentes:

- **Rosé = acento funcional.** Ação primária, item ativo, seleção, foco. É a cor que
  significa "aqui".
- **Dourado = detalhe metálico.** Hairline sob o overline, borda de card em destaque, ícone
  de estado premiado. **Nunca** em botão, nunca em link, nunca competindo por atenção.

Se em alguma tela o dourado começar a disputar com o rosé, o dourado é que sai.

## 2. Tokens

```css
@import "tailwindcss";

@theme {
  /* Neutros quentes */
  --color-bg:         #FDFBFA;
  --color-surface:    #FFFFFF;
  --color-surface-2:  #F7F1EE;
  --color-line:       #EDE3DE;
  --color-line-strong:#DFD1CA;

  /* Texto */
  --color-ink:        #2A2320;
  --color-ink-muted:  #8A7D76;
  --color-ink-subtle: #B3A79F;

  /* Acento */
  --color-accent:       #B76E79;
  --color-accent-hover: #A25C67;
  --color-accent-soft:  #F4E4E6;
  --color-accent-ink:   #7A3F48;

  /* Metálico — só detalhe */
  --color-gold:      #C4A25A;
  --color-gold-soft: #F5EDDD;

  /* Semânticos */
  --color-success:      #7C9885;
  --color-success-soft: #E8F0EA;
  --color-warn:         #D9A441;
  --color-warn-soft:    #FBF1DE;
  --color-danger:       #C1666B;
  --color-danger-soft:  #F8E8E9;
  --color-info:         #7B8FA8;
  --color-info-soft:    #E9EEF3;

  /* Tipografia */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-sans:    'Inter Tight', 'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* Raio — referências mostram cards macios */
  --radius-sm: 8px;
  --radius:    14px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  /* Sombra suave e difusa, tingida do neutro quente */
  --shadow-sm: 0 1px 2px rgb(42 35 32 / .04);
  --shadow:    0 8px 28px rgb(42 35 32 / .06);
  --shadow-lg: 0 16px 48px rgb(42 35 32 / .10);

  /* Movimento */
  --ease: cubic-bezier(.16, 1, .3, 1);
  --dur:  180ms;

  --container-shell: 1440px;
}
```

**Light-only nesta fase.** A estrutura já está pronta para dark por override de classe no
root (`meu-estilo-de-sites §dark/light`), mas a marca pede claridade e um dark meia-boca é
pior que nenhum.

## 3. Tipografia

| Papel | Fonte | Uso | Escala |
|---|---|---|---|
| Display | Cormorant Garamond | **só** título de página | `clamp(1.75rem, 2.4vw, 2.5rem)`, peso 500 |
| Corpo | Inter Tight | tudo o mais | 15px base, 14px em tabela densa |
| Mono | JetBrains Mono | overline, KPI, valor, data, CRP | tabular-nums obrigatório |

Sistema de uso diário: **legibilidade vence personalidade**. A serif aparece uma vez por
tela, no `h1`. Se aparecer em card, virou enfeite.

**Overline — a assinatura do vault:**

```css
.overline {
  font-family: var(--font-mono);
  font-size: .6875rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.overline::after {           /* hairline dourada */
  content: ""; display: block;
  width: 28px; height: 1px; margin-top: .5rem;
  background: var(--color-gold);
}
```

**Números sempre `font-variant-numeric: tabular-nums`.** Valor financeiro que dança de
largura entre linhas de tabela é o tipo de detalhe que faz o sistema parecer amador.

## 4. Componentes

Primitivos como classes em `@layer components` — não como componentes React
(`stack-padrao §padrões comprovados`).

```css
@layer components {
  .btn {
    display: inline-flex; align-items: center; gap: .5rem;
    height: 2.5rem; padding-inline: 1rem;
    border-radius: var(--radius-pill);
    font-weight: 500; font-size: .875rem;
    transition: all var(--dur) var(--ease);
  }
  .btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .btn-primary  { background: var(--color-accent); color: #fff; }
  .btn-primary:hover { background: var(--color-accent-hover); transform: translateY(-1px); }
  .btn-ghost    { background: transparent; color: var(--color-ink); }
  .btn-ghost:hover { background: var(--color-surface-2); }
  .btn-danger   { background: var(--color-danger-soft); color: var(--color-danger); }

  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
  }
  .card-highlight { border-color: var(--color-gold); }   /* único uso de dourado em borda */

  .field {
    height: 2.5rem; padding-inline: .75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-sm);
  }
  .field:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-soft); }
  .field[aria-invalid="true"] { border-color: var(--color-danger); }
}
```

### 4.1 Badge de status

Fundo suave + dot, nunca cor chapada. Cada status tem **uma** cor, usada em todo o sistema.

| Status | Token | Onde |
|---|---|---|
| Agendada | `info` | agenda |
| Confirmada | `success` | agenda |
| Atendida | `success` (sólido) | agenda |
| Falta | `danger` | agenda |
| Cancelada | `ink-subtle` | agenda |
| Previsto | `info` | financeiro |
| Faturado | `warn` | financeiro |
| Recebido | `success` | financeiro |
| Glosado | `danger` | financeiro |

### 4.2 Card de KPI

Padrão das 16 referências: overline pequeno, valor grande em mono, delta vs. período
anterior com seta. Sem ilustração 3D, sem gradiente.

```
┌─────────────────────────┐
│ ATENDIMENTOS NO MÊS     │  ← .overline
│ 342                     │  ← mono, 2rem, tabular-nums
│ ↑ 8% vs. mês anterior   │  ← success/danger, .75rem
└─────────────────────────┘
```

### 4.3 Componente de sigilo (`RecordLock`)

O componente que **não existe em nenhum CRM genérico** e é a marca do produto. Aparece
sempre que alguém sem permissão de conteúdo abre uma evolução.

```
┌───────────────────────────────────────────────┐
│ 🔒 Conteúdo protegido por sigilo profissional │
│                                               │
│ Sessão de 12/08 · 50 min · Atendida           │
│ Responsável: Ana Paula Vieira                 │
│                                               │
│ O conteúdo da evolução é acessível apenas à   │
│ profissional responsável.                     │
│                                               │
│ [ Acessar com justificativa ]                 │
└───────────────────────────────────────────────┘
```

Tom **informativo, nunca acusatório** — quem lê é a dona da clínica, não um invasor. O
botão abre modal com motivo obrigatório e o aviso de que a profissional será notificada.

### 4.4 Estados

Toda listagem implementa os seis estados de `02-fluxos.md §5`. Skeleton com a forma do
conteúdo (linhas de tabela, cards de KPI), nunca spinner solto.

## 5. Layout

- **Shell:** sidebar 248px fixa + conteúdo fluido, máx. 1440px.
- **Sidebar** agrupada por seção com overline (Atendimento / Gestão / Ajustes), item ativo
  com fundo `accent-soft` e barra rosé de 3px à esquerda.
- **Grid de dashboard:** 4 KPIs (`repeat(auto-fit, minmax(220px, 1fr))`) → gráfico dominante
  2/3 + satélites 1/3 → tabela largura cheia.
- **Densidade de tabela:** linha de 52px, 14px de fonte, zebra desligada (usa-se `line`).
- **Breakpoints:** 640 / 768 / 1024 / 1280. Em ≤768px a sidebar vira bottom nav.

## 6. Movimento

| Onde | O quê |
|---|---|
| Hover de botão | `translateY(-1px)` |
| Hover de card clicável | `box-shadow` sobe para `--shadow-lg` |
| Entrada de modal/drawer | fade + `translateY(8px)`, 180ms |
| Troca de rota | fade de 120ms, sem deslocamento |
| Skeleton | pulse de 1.6s |

Tudo com `var(--ease)`. **`prefers-reduced-motion` desliga transform e mantém opacidade**
(RNF-07). Nada de scroll reveal — é um sistema, não uma landing.

## 7. Acessibilidade

Não é acabamento; é característica do trabalho (`meu-estilo-de-sites §acessibilidade`).

- Skip-link para o conteúdo principal
- `:focus-visible` em 100% dos interativos, com o outline rosé acima
- `aria-label` em pt-BR na navegação e nos botões só-ícone
- Contraste AA: `ink` sobre `bg` = 12.6:1 · `ink-muted` sobre `bg` = 4.7:1 · branco sobre
  `accent` = 4.6:1 ✓
- **Status nunca comunicado só por cor** — sempre cor + texto
- Tabela com `<caption>` visualmente oculto, `scope` nos cabeçalhos
- Agenda navegável por teclado: setas movem entre horários, Enter abre
- Modal com foco preso e retorno ao gatilho no fechamento
- `aria-live="polite"` em erro de formulário e em confirmação de salvamento

## 8. Ícones

SVG desenhado à mão em `src/components/icons/` (`stack-padrao`: "ícones = SVG próprio").
Traço 1.5px, 20×20 padrão, `currentColor`. Sem biblioteca de ícones, sem emoji como ícone
de UI.

## 9. O que este design system não faz

- Não usa shadcn/ui nem Radix (§4.5 do prompt)
- Não tem dark mode nesta fase
- Não tem gradiente, exceto o overlay de legibilidade se houver foto
- Não usa mais de um acento funcional
- Não anima entrada de conteúdo por scroll

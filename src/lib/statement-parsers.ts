/**
 * Leitura de extrato bancário no navegador.
 *
 * CSV e OFX são lidos de verdade. PDF não: extrair texto de PDF exige uma
 * biblioteca pesada e o resultado varia demais entre bancos, então o arquivo
 * é guardado como referência e as linhas entram manualmente. Melhor admitir
 * isso do que importar valor errado num extrato.
 */

export interface ParsedLine {
  date: string;
  description: string;
  amount: number;
}

export interface ParseResult {
  lines: ParsedLine[];
  /** Aviso a mostrar na tela quando o arquivo não pôde ser lido por completo. */
  warning?: string;
}

/* ------------------------------------------------------------------- CSV */

/** Divide respeitando aspas, para descrição que contém o separador. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function detectDelimiter(sample: string): string {
  const counts = [";", ",", "\t"].map((d) => ({
    d,
    n: sample.split(d).length - 1,
  }));
  return counts.sort((a, b) => b.n - a.n)[0]?.d ?? ";";
}

/** Aceita 1.234,56 · 1,234.56 · -150.00 · (150,00) · 150,00 D */
export function parseAmount(raw: string): number | null {
  let text = raw.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!text) return null;

  let negative = text.startsWith("-") || /^D/i.test(text) || /D$/i.test(text);
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^[-+DC]/i, "").replace(/[DC]$/i, "");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  if (!/^\d*\.?\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

/** Aceita 17/08/2026 · 2026-08-17 · 17-08-2026 · 20260817 */
export function parseDate(raw: string): string | null {
  const text = raw.trim();

  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

export function parseCsv(text: string): ParseResult {
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  if (!rows.length) return { lines: [], warning: "Arquivo vazio." };

  const delimiter = detectDelimiter(rows.slice(0, 5).join("\n"));
  const table = rows.map((r) => splitLine(r, delimiter));

  // A primeira linha com data numa coluna marca onde os dados começam;
  // o que vier antes é cabeçalho do banco.
  let start = 0;
  let dateCol = -1;
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const found = table[i]!.findIndex((c) => parseDate(c) !== null);
    if (found >= 0) {
      start = i;
      dateCol = found;
      break;
    }
  }
  if (dateCol < 0) {
    return {
      lines: [],
      warning: "Não encontrei uma coluna de data neste arquivo.",
    };
  }

  const lines: ParsedLine[] = [];
  let skipped = 0;

  for (let i = start; i < table.length; i++) {
    const cells = table[i]!;
    const date = parseDate(cells[dateCol] ?? "");
    if (!date) {
      skipped++;
      continue;
    }

    // Valor: última coluna que tenha dígito e leia como número.
    let amount: number | null = null;
    let amountCol = -1;
    for (let c = cells.length - 1; c >= 0; c--) {
      if (c === dateCol) continue;
      const cell = cells[c] ?? "";
      if (!/\d/.test(cell)) continue;
      const v = parseAmount(cell);
      if (v !== null) {
        amount = v;
        amountCol = c;
        break;
      }
    }
    if (amount === null) {
      skipped++;
      continue;
    }

    const description =
      cells
        .filter((_, c) => c !== dateCol && c !== amountCol)
        .join(" ")
        .trim()
        .slice(0, 120) || "Sem descrição";

    lines.push({ date, description, amount });
  }

  return {
    lines,
    warning:
      skipped > 0
        ? `${skipped} linhas ignoradas por não ter data ou valor reconhecível.`
        : undefined,
  };
}

/* ------------------------------------------------------------- OFX / XML */

export function parseOfx(text: string): ParseResult {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (!blocks.length) {
    return { lines: [], warning: "Não encontrei transações neste arquivo." };
  }

  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
    return m?.[1]?.trim() ?? "";
  };

  const lines: ParsedLine[] = [];
  for (const block of blocks) {
    const date = parseDate(tag(block, "DTPOSTED"));
    const amount = parseAmount(tag(block, "TRNAMT"));
    if (!date || amount === null) continue;
    const description =
      tag(block, "MEMO") || tag(block, "NAME") || tag(block, "TRNTYPE") || "Sem descrição";
    lines.push({ date, description: description.slice(0, 120), amount });
  }

  return {
    lines,
    warning: lines.length ? undefined : "Nenhuma transação legível no arquivo.",
  };
}

/* ------------------------------------------------------------------- PDF */

export function parsePdf(): ParseResult {
  return {
    lines: [],
    warning:
      "PDF não é lido automaticamente: cada banco monta o arquivo de um jeito e o risco de importar valor errado é alto. Baixe o extrato em CSV ou OFX no aplicativo do banco, ou lance as linhas manualmente.",
  };
}

export function parseStatement(
  fileName: string,
  text: string,
): ParseResult & { source: "csv" | "ofx" | "pdf" } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return { ...parsePdf(), source: "pdf" };
  if (lower.endsWith(".ofx") || lower.endsWith(".xml") || text.includes("<STMTTRN>")) {
    return { ...parseOfx(text), source: "ofx" };
  }
  return { ...parseCsv(text), source: "csv" };
}

export const brl = (value: number): string =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (value: number, digits = 1): string =>
  `${value.toFixed(digits).replace(".", ",")}%`;

export const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const date = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const dateLong = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export const monthLabel = (yyyyMm: string): string => {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
};

export const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Valor curto para caber em espaço apertado: R$ 167,4 mil · R$ 1,2 mi */
export const brlCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  }
  if (abs >= 10_000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  }
  return brl(value);
};

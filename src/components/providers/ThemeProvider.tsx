"use client";

/**
 * Aparência: tema (claro/escuro), paleta de cor e tamanho de fonte.
 *
 * Tudo por atributo/classe no elemento raiz — a estratégia usada em todos os
 * projetos do vault (`meu-estilo-de-sites` §dark/light). Sem opção "sistema":
 * a escolha é sempre explícita.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeChoice = "light" | "dark";
export type PaletteChoice = "rose" | "clinica";
export type FontScale = "pequena" | "normal" | "grande" | "maior";

const KEYS = {
  theme: "crm_exemplo_ejuvv:theme",
  palette: "crm_exemplo_ejuvv:palette",
  font: "crm_exemplo_ejuvv:font",
};

export const PALETTES: { id: PaletteChoice; label: string; hint: string; swatch: string[] }[] = [
  {
    id: "rose",
    label: "Rosé e dourado",
    hint: "Neutros quentes com acento rosé",
    swatch: ["#B76E79", "#C4A25A", "#F7F1EE"],
  },
  {
    id: "clinica",
    label: "Verde e coral",
    hint: "Alternativa institucional",
    swatch: ["#123F49", "#E9836E", "#DCEFE8"],
  },
];

export const FONT_SCALES: { id: FontScale; label: string; value: number }[] = [
  { id: "pequena", label: "Pequena", value: 0.925 },
  { id: "normal", label: "Padrão", value: 1 },
  { id: "grande", label: "Grande", value: 1.09 },
  { id: "maior", label: "Maior", value: 1.2 },
];

interface ThemeContextValue {
  theme: ThemeChoice;
  palette: PaletteChoice;
  font: FontScale;
  setTheme: (t: ThemeChoice) => void;
  setPalette: (p: PaletteChoice) => void;
  setFont: (f: FontScale) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(theme: ThemeChoice, palette: PaletteChoice, font: FontScale): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-palette", palette);
  const scale = FONT_SCALES.find((f) => f.id === font)?.value ?? 1;
  root.style.setProperty("--font-scale", String(scale));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("light");
  const [palette, setPaletteState] = useState<PaletteChoice>("rose");
  const [font, setFontState] = useState<FontScale>("normal");

  useEffect(() => {
    const t = (window.localStorage.getItem(KEYS.theme) === "dark" ? "dark" : "light") as ThemeChoice;
    const p = (window.localStorage.getItem(KEYS.palette) === "clinica" ? "clinica" : "rose") as PaletteChoice;
    const stored = window.localStorage.getItem(KEYS.font) as FontScale | null;
    const f: FontScale = FONT_SCALES.some((x) => x.id === stored) ? stored! : "normal";

    setThemeState(t);
    setPaletteState(p);
    setFontState(f);
    apply(t, p, f);
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    window.localStorage.setItem(KEYS.theme, next);
    setThemeState(next);
    setPaletteState((p) => { setFontState((f) => { apply(next, p, f); return f; }); return p; });
  }, []);

  const setPalette = useCallback((next: PaletteChoice) => {
    window.localStorage.setItem(KEYS.palette, next);
    setPaletteState(next);
    setThemeState((t) => { setFontState((f) => { apply(t, next, f); return f; }); return t; });
  }, []);

  const setFont = useCallback((next: FontScale) => {
    window.localStorage.setItem(KEYS.font, next);
    setFontState(next);
    setThemeState((t) => { setPaletteState((p) => { apply(t, p, next); return p; }); return t; });
  }, []);

  const value = useMemo(
    () => ({ theme, palette, font, setTheme, setPalette, setFont }),
    [theme, palette, font, setTheme, setPalette, setFont],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}

/** Evita o flash de tema/paleta errados antes da hidratação. */
export const THEME_INIT_SCRIPT = `
(function(){try{
var r=document.documentElement;
if(localStorage.getItem('${KEYS.theme}')==='dark')r.classList.add('dark');
r.setAttribute('data-palette',localStorage.getItem('${KEYS.palette}')==='clinica'?'clinica':'rose');
var m={pequena:0.925,normal:1,grande:1.09,maior:1.2};
r.style.setProperty('--font-scale',m[localStorage.getItem('${KEYS.font}')]||1);
}catch(e){}})();
`;

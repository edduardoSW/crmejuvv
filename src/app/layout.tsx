import type { Metadata } from "next";
import { AppProvider } from "@/components/providers/AppProvider";
import {
  ThemeProvider,
  THEME_INIT_SCRIPT,
} from "@/components/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Exemplo · EJUVV",
  description:
    "CRM demonstrativo da EJUVV para gestão de clínicas: agenda, prontuário e financeiro.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Evita o flash de tema claro antes da hidratação. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <ThemeProvider>
          <AppProvider>{children}</AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

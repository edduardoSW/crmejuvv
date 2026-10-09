"use client";

import { useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { hasPermission, type Permission } from "@/lib/domain/types";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { CatalogSettings } from "@/components/settings/CatalogSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";

type Tab =
  | "perfil" | "integracoes" | "aparencia"
  | "equipe" | "convenios" | "servicos" | "salas";

/**
 * Toda pessoa tem Configurações — perfil e aparência são de uso pessoal.
 * As abas de administração só aparecem para quem tem a permissão; nada de
 * mostrar a aba e bloquear depois.
 */
const TABS: { id: Tab; label: string; permission?: Permission }[] = [
  { id: "perfil", label: "Meu perfil" },
  { id: "integracoes", label: "Integrações" },
  { id: "aparencia", label: "Aparência" },
  { id: "equipe", label: "Equipe e acessos", permission: "team.manage" },
  { id: "convenios", label: "Convênios", permission: "settings.manage" },
  { id: "servicos", label: "Serviços e valores", permission: "settings.manage" },
  { id: "salas", label: "Salas", permission: "settings.manage" },
];

export default function ConfiguracoesPage() {
  const { scope, isSolo } = useApp();
  const [tab, setTab] = useState<Tab>("perfil");

  if (!scope) return null;

  const visible = TABS.filter((t) => {
    // Equipe e acessos só aparece quando existe equipe.
    if (t.id === "equipe" && isSolo) return false;
    return !t.permission || hasPermission(scope, t.permission);
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="overline overline-gold">Ajustes</p>
        <h1 className="mt-3">Configurações</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
          {visible.length < TABS.length
            ? "Você vê as configurações disponíveis para o seu perfil."
            : "Perfil, aparência, integrações e cadastros do consultório."}
        </p>
      </header>

      <div role="tablist" className="tabs">
        {visible.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
            )}
          </button>
        ))}
      </div>

      {tab === "perfil" && <ProfileSettings />}
      {tab === "integracoes" && <IntegrationsSettings />}
      {tab === "aparencia" && <AppearanceSettings />}
      {tab === "equipe" && <TeamSettings />}
      {tab === "convenios" && <CatalogSettings kind="convenios" />}
      {tab === "servicos" && <CatalogSettings kind="servicos" />}
      {tab === "salas" && <CatalogSettings kind="salas" />}
    </div>
  );
}

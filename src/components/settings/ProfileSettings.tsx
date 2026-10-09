"use client";

/**
 * Meu perfil — disponível para qualquer papel.
 * Cada pessoa corrige o próprio cadastro sem depender da administração.
 */

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABELS } from "@/lib/domain/types";

export function ProfileSettings() {
  const { scope, profile, role, org, signOut } = useApp();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", crp: "", specialty: "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone ?? "",
      crp: profile.crp ?? "",
      specialty: profile.specialty ?? "",
    });
  }, [profile]);

  if (!scope || !profile || !role) return null;

  async function save() {
    if (!scope || !profile) return;
    setError(null);
    try {
      await repo.team.updateProfile(scope, profile.id, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        crp: form.crp || null,
        specialty: form.specialty || null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(messageFor(e));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <section className="card p-6">
        <h2>Meus dados</h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
          Corrija seu nome, contato e registro profissional.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pf-nome">Nome completo</label>
            <input
              id="pf-nome"
              className="field"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pf-email">E-mail</label>
            <input
              id="pf-email"
              type="email"
              className="field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pf-tel">Telefone</label>
            <input
              id="pf-tel"
              className="field"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pf-crp">CRP</label>
            <input
              id="pf-crp"
              className="field"
              placeholder="05/12345"
              value={form.crp}
              onChange={(e) => setForm({ ...form, crp: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pf-esp">Abordagem</label>
            <input
              id="pf-esp"
              className="field"
              placeholder="Ex.: Terapia Cognitivo-Comportamental"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            Salvar alterações
          </button>
          {saved && (
            <span className="text-sm text-[var(--color-success)]">Salvo.</span>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        <div className="card flex flex-col items-center p-6 text-center">
          <Avatar name={profile.full_name} size="xl" />
          <p className="mt-3 font-medium">{profile.full_name}</p>
          <span
            className="badge badge-plain mt-2"
            style={{
              background: "var(--color-accent-soft)",
              color: "var(--color-accent-ink)",
            }}
          >
            {ROLE_LABELS[role]}
          </span>
          <p className="mt-3 text-xs text-[var(--color-ink-muted)]">{org?.name}</p>
        </div>

        <div className="card p-5">
          <p className="overline">Sessão</p>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Sair encerra o acesso neste navegador.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm mt-4 w-full"
            onClick={signOut}
          >
            Sair da conta
          </button>
        </div>
      </aside>
    </div>
  );
}

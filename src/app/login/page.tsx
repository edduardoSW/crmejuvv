"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Mode = "entrar" | "criar";

export default function LoginPage() {
  const { ready, authenticated, signIn, resetDemo } = useApp();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("demo@ejuvv.com");
  const [password, setPassword] = useState("demonstracao");
  const [name, setName] = useState("");
  const [crp, setCrp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && authenticated) router.replace("/dashboard");
  }, [ready, authenticated, router]);

  function enter() {
    setError(null);
    setBusy(true);
    const result = signIn(email);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível entrar.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-9 w-9 place-items-center rounded-[10px] font-[family-name:var(--font-display)] text-base text-white"
              style={{ background: "var(--color-accent)" }}
              aria-hidden="true"
            >
              EJ
            </span>
            <span className="font-[family-name:var(--font-display)] text-xl">
              CRM Exemplo
            </span>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-accent)]">
            Uma demonstração da EJUVV
          </p>

          {/* ------------------------------------------------ abas */}
          <div
            role="tablist"
            aria-label="Entrar ou criar conta"
            className="mt-10 inline-flex rounded-full bg-[var(--color-surface-2)] p-1"
          >
            {(["entrar", "criar"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-soft)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <h1 className="mt-6">
            {mode === "entrar" ? "Bem-vinda de volta" : "Criar sua conta"}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {mode === "entrar"
              ? "Explore o CRM demonstrativo da EJUVV."
              : "Cadastre-se para começar a organizar a rotina."}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enter();
            }}
            className="mt-6 space-y-4"
            noValidate
          >
            {mode === "criar" && (
              <>
                <div>
                  <label className="label" htmlFor="nome">
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    className="field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como aparece no seu registro"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="crp">
                    CRP <span className="text-[var(--color-ink-subtle)]">(opcional)</span>
                  </label>
                  <input
                    id="crp"
                    className="field"
                    value={crp}
                    onChange={(e) => setCrp(e.target.value)}
                    placeholder="05/12345"
                  />
                </div>
              </>
            )}

            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? "true" : undefined}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="senha">
                  Senha
                </label>
                {mode === "entrar" && (
                  <button
                    type="button"
                    className="mb-1.5 text-xs text-[var(--color-accent)] hover:underline"
                    onClick={(e) => e.preventDefault()}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <input
                id="senha"
                type="password"
                autoComplete={
                  mode === "entrar" ? "current-password" : "new-password"
                }
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy || !ready}
            >
              {busy
                ? "Entrando…"
                : mode === "entrar"
                  ? "Entrar"
                  : "Criar conta e entrar"}
            </button>
          </form>

          <div className="mt-8 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
            <p className="overline">CRM Exemplo · EJUVV</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">
              Este é um ambiente demonstrativo. A autenticação é simulada,
              qualquer senha entra e todos os dados são fictícios.
            </p>
            <button
              type="button"
              onClick={resetDemo}
              className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
            >
              Recriar os dados de demonstração
            </button>
            <div className="mt-3 space-y-1">
              {[
                { email: "demo@ejuvv.com", role: "Conta de demonstração" },
              ].map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setMode("entrar");
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-surface)] ${
                    email === account.email
                      ? "bg-[var(--color-surface)] ring-1 ring-[var(--color-accent-soft)]"
                      : ""
                  }`}
                >
                  <span className="truncate font-[family-name:var(--font-mono)]">
                    {account.email}
                  </span>
                  <span className="shrink-0 text-[var(--color-ink-subtle)]">
                    {account.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- arte */}
      <div
        className="relative hidden overflow-hidden lg:block"
        style={{
          background:
            "linear-gradient(150deg, var(--color-surface-2) 0%, var(--color-accent-soft) 48%, var(--color-gold-soft) 100%)",
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 grid place-items-center p-16">
          <div className="max-w-md">
            <p className="overline overline-gold">CRM Exemplo · EJUVV</p>
            <p className="mt-6 font-[family-name:var(--font-display)] text-[2.5rem] leading-[1.15]">
              Gestão clínica clara, conectada e pronta para demonstrar.
            </p>
            <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
              Um exemplo desenvolvido pela EJUVV com agenda, prontuário e
              faturamento por convênio no mesmo lugar.
            </p>
          </div>
        </div>

        <svg
          className="absolute -bottom-28 -right-28 opacity-[0.16]"
          width="440"
          height="440"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="99" stroke="var(--color-gold)" />
          <circle cx="100" cy="100" r="72" stroke="var(--color-accent)" />
          <circle cx="100" cy="100" r="45" stroke="var(--color-gold)" />
        </svg>
      </div>
    </div>
  );
}

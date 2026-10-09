"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { hasPermission, ROLE_LABELS } from "@/lib/domain/types";
import type { Permission } from "@/lib/domain/types";
import { initials } from "@/lib/format";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ASSISTANT_NAME } from "@/lib/assistant-identity";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconChart,
  IconChevronDown,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconMoney,
  IconMore,
  IconRecord,
  IconSearch,
  IconSettings,
  IconSparkle,
  IconUsers,
  IconX,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  permission?: Permission;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "Atendimento",
    items: [
      { href: "/dashboard", label: "Início", icon: IconDashboard },
      { href: "/agenda", label: "Agenda", icon: IconCalendar },
      { href: "/pacientes", label: "Pacientes", icon: IconUsers },
      { href: "/prontuarios", label: "Prontuários", icon: IconRecord, permission: "record.read.own" },
      { href: "/tarefas", label: "Tarefas", icon: IconCheck },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: IconMoney, permission: "finance.entry.manage" },
      { href: "/relatorios", label: "Relatórios", icon: IconChart, permission: "report.read.all" },
    ],
  },
  {
    title: "Inteligência",
    items: [{ href: "/assistente", label: ASSISTANT_NAME, icon: IconSparkle, badge: "IA" }],
  },
  {
    title: "Ajustes",
    // Sem permissão: todo mundo tem perfil e aparência. As abas internas é
    // que são filtradas por papel.
    items: [{ href: "/configuracoes", label: "Configurações", icon: IconSettings }],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, failure, authenticated, scope, org, profile, role, resetDemo } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !failure && !authenticated) router.replace("/login");
  }, [ready, failure, authenticated, router]);

  // Fecha o menu ao navegar — no celular ele cobre a tela inteira.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  if (ready && failure) return <StartupFailure message={failure} onReset={resetDemo} />;

  if (!ready || !scope || !org || !profile || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  // Telas que ocupam toda a area util (o proprio conteudo rola por dentro).
  const fullBleed = pathname.startsWith("/assistente");

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(scope, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--color-bg)]">
      {/* -------------------------------------------- sidebar (desktop) */}
      <aside
        className="hidden w-[252px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] md:flex"
        aria-label="Navegação principal"
      >
        <BrandHeader />
        <OrgHeader />
        <NavList groups={groups} pathname={pathname} />
        <UserFooter />
      </aside>

      {/* ------------------------------------- menu deslizante (mobile) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]"
            style={{ animation: "riseIn 200ms var(--ease-out-expo) both" }}
          >
            <div className="flex items-center justify-between pr-2">
              <div className="min-w-0 flex-1">
                <BrandHeader />
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                className="btn btn-ghost h-9 w-9 shrink-0 !px-0"
                onClick={() => setMenuOpen(false)}
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <OrgHeader />
            <NavList groups={groups} pathname={pathname} />
            <div className="border-t border-[var(--color-line)] p-3">
              <ThemeToggle />
            </div>
            <UserFooter />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col ">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <main
          id="conteudo"
          className={
            fullBleed
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-[4.5rem] md:p-4 md:pb-4"
              : "min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-5 sm:pt-6 md:px-8 md:pb-10"
          }
        >
          {fullBleed ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          )}
        </main>
      </div>

      <MobileNav groups={groups} pathname={pathname} onMore={() => setMenuOpen(true)} />
    </div>
  );
}

/* ---------------------------------------------------------------- nav */

function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[var(--color-accent)] font-[family-name:var(--font-mono)] text-xs font-medium text-white"
        aria-hidden="true"
      >
        EJ
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">
          CRM Exemplo
        </span>
        <span className="block text-xs text-[var(--color-ink-subtle)]">
          uma demonstração EJUVV
        </span>
      </span>
    </div>
  );
}

function NavList({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6">
      {groups.map((group, gi) => (
        <div
          key={group.title}
          className={gi === 0 ? "pb-2" : "mt-2 border-t border-[var(--color-line)] pt-5"}
        >
          <p className="overline mb-2.5 px-3 leading-none">{group.title}</p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 rounded-[10px] pl-3 pr-2.5 text-[0.9375rem] transition-colors ${
                      active
                        ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-ink)]"
                        : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{ background: "var(--color-accent)" }}
                        aria-hidden="true"
                      />
                    )}
                    <Icon width={18} height={18} className={active ? "" : "text-[var(--color-ink-subtle)]"} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className="rounded-full px-1.5 py-[3px] font-[family-name:var(--font-mono)] text-[10px] leading-none"
                        style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function OrgHeader() {
  const { org, myOrgs, switchOrg } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!org) return null;
  const single = myOrgs.length <= 1;

  return (
    <div ref={ref} className="relative px-3 pb-4 pt-1">
      <button
        type="button"
        onClick={() => !single && setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup={single ? undefined : "menu"}
        className={`flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors ${
          single ? "cursor-default" : "hover:bg-[var(--color-surface-2)]"
        }`}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-[family-name:var(--font-display)] text-base text-white"
          style={{ background: "var(--color-accent)" }}
          aria-hidden="true"
        >
          CE
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">{org.name}</span>
          <span className="block text-xs text-[var(--color-ink-subtle)]">
            Dados fictícios
          </span>
        </span>
        {!single && <IconChevronDown width={16} height={16} className="shrink-0 text-[var(--color-ink-subtle)]" />}
      </button>

      {open && (
        <div role="menu" className="card absolute left-3 right-3 top-[calc(100%-0.25rem)] z-30 overflow-hidden p-1">
          {myOrgs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => { switchOrg(o.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-2)] ${
                o.id === org.id ? "font-medium" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserFooter() {
  const { profile, role, signOut } = useApp();
  const router = useRouter();
  if (!profile || !role) return null;

  return (
    <div className="border-t border-[var(--color-line)] p-3">
      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-medium"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)" }}
          aria-hidden="true"
        >
          {initials(profile.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{profile.full_name}</span>
          <span className="block truncate text-xs text-[var(--color-ink-subtle)]">{ROLE_LABELS[role]}</span>
        </span>
        <button
          type="button"
          aria-label="Sair"
          title="Sair"
          onClick={() => { signOut(); router.replace("/login"); }}
          className="btn btn-ghost h-8 w-8 shrink-0 !px-0 text-[var(--color-ink-muted)]"
        >
          <IconLogout width={17} height={17} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- topbar */

/**
 * Barra superior. Sem busca global: cada módulo tem a própria busca, com os
 * filtros que fazem sentido ali — um campo genérico no topo duplicava a busca
 * da tela e não sabia o que procurar.
 */
function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { org } = useApp();
  const pathname = usePathname();

  const title =
    NAV.flatMap((g) => g.items).find(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
    )?.label ?? "";

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-3 backdrop-blur-md sm:px-5 md:px-8">
      <button
        type="button"
        aria-label="Abrir menu"
        className="btn btn-ghost h-10 w-10 shrink-0 !px-0 md:hidden"
        onClick={onOpenMenu}
      >
        <IconMenu width={20} height={20} />
      </button>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        <p className="truncate text-xs text-[var(--color-ink-subtle)]">
          {org?.name}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <span className="hidden rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-ink-muted)] lg:inline-flex">
          CRM EXEMPLO · EJUVV
        </span>
        <Clock />
        <span className="hidden md:inline-flex">
          <ThemeToggle compact />
        </span>
        <button type="button" className="btn btn-ghost relative h-10 w-10 !px-0" aria-label="Notificações">
          <IconBell width={18} height={18} />
          <span
            className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-accent)" }}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}

/**
 * Relógio do cabeçalho. Só renderiza depois de montar — a hora do servidor
 * nunca bate com a do navegador e causaria erro de hidratação.
 */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) return <span className="w-[92px]" aria-hidden="true" />;

  return (
    <div className="mr-1 hidden text-right leading-tight sm:block">
      <p className="tabular font-[family-name:var(--font-mono)] text-sm">
        {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="text-[11px] capitalize text-[var(--color-ink-subtle)]">
        {now.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- estados */

function StartupFailure({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-6">
        <p className="overline overline-gold">CRM Exemplo · EJUVV</p>
        <h1 className="mt-3 text-2xl">Não foi possível carregar os dados</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{message}</p>
        <button type="button" className="btn btn-primary mt-6 w-full sm:w-auto" onClick={onReset}>
          Limpar e recriar os dados
        </button>
      </div>
    </div>
  );
}

function MobileNav({
  groups,
  pathname,
  onMore,
}: {
  groups: NavGroup[];
  pathname: string;
  onMore: () => void;
}) {
  const all = groups.flatMap((g) => g.items);
  const primary = all.slice(0, 4);
  const hasMore = all.length > 4;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-line)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navegação"
    >
      {primary.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] ${
              active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-muted)]"
            }`}
          >
            <Icon width={20} height={20} />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={onMore}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] text-[var(--color-ink-muted)]"
        >
          <IconMore width={20} height={20} />
          <span>Mais</span>
        </button>
      )}
    </nav>
  );
}

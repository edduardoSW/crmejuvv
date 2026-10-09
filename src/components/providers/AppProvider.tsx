"use client";

/**
 * Sessão da aplicação.
 *
 * O login é real do ponto de vista da experiência (tela, e-mail, sessão
 * persistida, sair), mas a verificação é simulada: qualquer senha entra, desde
 * que o e-mail exista na base. Na fase 2, `signIn` passa a chamar o Supabase e
 * o `Scope` passa a ser derivado da sessão no servidor — nada mais muda.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ensureSeeded, resetToSeed } from "@/lib/repository/local/helpers";
import { subscribe, readDatabase, resetDatabase } from "@/lib/repository/store";
import { messageFor } from "@/lib/repository/errors";
import { buildScope } from "@/lib/domain/types";
import type {
  Membership,
  Organization,
  Profile,
  Role,
  Scope,
  Uuid,
} from "@/lib/domain/types";

const SESSION_KEY = "crm_exemplo_ejuvv:v1:session";

interface StoredSession {
  profile_id: Uuid;
  org_id: Uuid;
}

interface Snapshot {
  organizations: Organization[];
  profiles: Profile[];
  memberships: Membership[];
}

interface AppContextValue {
  ready: boolean;
  failure: string | null;
  authenticated: boolean;
  scope: Scope | null;
  org: Organization | null;
  profile: Profile | null;
  role: Role | null;
  /** Organizações às quais a pessoa logada pertence. */
  myOrgs: Organization[];
  /**
   * Consultório de uma profissional só.
   *
   * O modelo continua multi-profissional (org_id e papéis seguem intactos),
   * mas a interface esconde tudo o que só faz sentido com equipe: filtro por
   * profissional, escolha de responsável, repasse, compartilhamento de
   * evolução e a aba de equipe. Quando uma segunda pessoa for cadastrada,
   * esses pontos reaparecem sozinhos.
   */
  isSolo: boolean;
  signIn: (email: string) => { ok: boolean; error?: string };
  signOut: () => void;
  switchOrg: (orgId: Uuid) => void;
  resetDemo: () => void;
  revision: number;
}

const AppContext = createContext<AppContextValue | null>(null);

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    organizations: [],
    profiles: [],
    memberships: [],
  });

  const load = useCallback(() => {
    const data = readDatabase();
    setSnapshot({
      organizations: data.organizations,
      profiles: data.profiles,
      memberships: data.memberships,
    });
  }, []);

  useEffect(() => {
    try {
      const data = ensureSeeded();
      setSnapshot({
        organizations: data.organizations,
        profiles: data.profiles,
        memberships: data.memberships,
      });
      setSession(readSession());
    } catch (e) {
      setFailure(messageFor(e));
    } finally {
      setReady(true);
    }

    return subscribe(() => {
      load();
      setRevision((r) => r + 1);
    });
  }, [load]);

  const profile = useMemo(
    () => snapshot.profiles.find((p) => p.id === session?.profile_id) ?? null,
    [snapshot.profiles, session],
  );

  const myMemberships = useMemo(
    () =>
      snapshot.memberships.filter(
        (m) => m.profile_id === session?.profile_id && m.status === "active",
      ),
    [snapshot.memberships, session],
  );

  const myOrgs = useMemo(
    () =>
      myMemberships
        .map((m) => snapshot.organizations.find((o) => o.id === m.org_id))
        .filter((o): o is Organization => Boolean(o)),
    [myMemberships, snapshot.organizations],
  );

  const membership = useMemo(
    () => myMemberships.find((m) => m.org_id === session?.org_id) ?? null,
    [myMemberships, session],
  );

  const org = useMemo(
    () => snapshot.organizations.find((o) => o.id === session?.org_id) ?? null,
    [snapshot.organizations, session],
  );

  /** Quem atende nesta organização (recepção não conta). */
  const professionalCount = useMemo(() => {
    if (!session) return 0;
    return snapshot.memberships.filter(
      (m) =>
        m.org_id === session.org_id &&
        m.status === "active" &&
        m.role !== "reception",
    ).length;
  }, [snapshot.memberships, session]);

  const scope = useMemo<Scope | null>(() => {
    if (!profile || !org || !membership) return null;
    return buildScope(org.id, profile.id, membership.role);
  }, [profile, org, membership]);

  const signIn = useCallback(
    (email: string) => {
      const data = readDatabase();
      /**
       * Demonstração: o clique em "Entrar" sempre entra. Se o e-mail digitado
       * não existir na base fictícia, a sessão cai na conta da dona — assim
       * ninguém trava na frente da cliente por causa de um typo.
       */
      const found =
        data.profiles.find(
          (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
        ) ??
        data.profiles.find((p) =>
          data.memberships.some(
            (m) => m.profile_id === p.id && m.role === "owner",
          ),
        );

      if (!found) {
        return { ok: false, error: "Base de demonstração ainda carregando." };
      }
      const membershipsOf = data.memberships.filter(
        (m) => m.profile_id === found.id && m.status === "active",
      );
      if (!membershipsOf.length) {
        return { ok: false, error: "Esta conta não tem acesso ativo." };
      }
      // Prioriza a clínica quando a pessoa pertence às duas.
      const preferred =
        membershipsOf.find((m) => {
          const o = data.organizations.find((x) => x.id === m.org_id);
          return o?.type === "clinica";
        }) ?? membershipsOf[0]!;

      const next = { profile_id: found.id, org_id: preferred.org_id };
      writeSession(next);
      setSession(next);
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  const switchOrg = useCallback(
    (orgId: Uuid) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, org_id: orgId };
        writeSession(next);
        return next;
      });
    },
    [],
  );

  const resetDemo = useCallback(() => {
    try {
      resetDatabase();
      resetToSeed();
      writeSession(null);
      setSession(null);
      setFailure(null);
      load();
      setRevision((r) => r + 1);
    } catch (e) {
      setFailure(messageFor(e));
    }
  }, [load]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      failure,
      authenticated: Boolean(scope),
      scope,
      org,
      profile,
      role: membership?.role ?? null,
      myOrgs,
      isSolo: professionalCount <= 1,
      signIn,
      signOut,
      switchOrg,
      resetDemo,
      revision,
    }),
    [
      ready, failure, scope, org, profile, membership, myOrgs, professionalCount,
      signIn, signOut, switchOrg, resetDemo, revision,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa estar dentro de <AppProvider>");
  return ctx;
}

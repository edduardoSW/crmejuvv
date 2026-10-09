"use client";

/**
 * Conteúdo da evolução, com compartilhamento.
 *
 * Cada profissional vê as próprias evoluções. Para outra pessoa ler, a autora
 * compartilha explicitamente — e pode revogar depois. Quem não é autora nem
 * recebeu compartilhamento vê apenas os metadados.
 */

import { useCallback, useEffect, useState } from "react";
import { repo, messageFor, isRepoError } from "@/lib/repository";
import { Select } from "@/components/ui/Select";
import { date } from "@/lib/format";
import type {
  ClinicalRecordMeta, Profile, RecordShare, Scope, Template,
} from "@/lib/domain/types";
import { IconCheck, IconLock, IconPlus, IconX } from "@/components/icons";

export function RecordViewer({
  scope,
  record,
  author,
  professionals,
  templates,
  onChanged,
  onClose,
  renderFooter,
}: {
  scope: Scope;
  record: ClinicalRecordMeta;
  author?: Profile;
  professionals: Profile[];
  templates?: Template[];
  onChanged: () => void;
  onClose: () => void;
  renderFooter?: (actions: React.ReactNode) => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [locked, setLocked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [shares, setShares] = useState<RecordShare[]>([]);
  const [shareWith, setShareWith] = useState("");
  const [sharing, setSharing] = useState(false);

  const isAuthor = record.professional_id === scope.profile_id;

  const loadShares = useCallback(async () => {
    setShares(await repo.records.listShares(scope, record.id));
  }, [scope, record.id]);

  useEffect(() => {
    setContent(null); setDenied(false); setError(null); setSaved(false);
    (async () => {
      try {
        const full = await repo.records.getContent(scope, record.id);
        setContent(full.content);
        setDraft(full.content);
        setLocked(full.is_locked);
      } catch (e) {
        if (isRepoError(e) && e.code === "forbidden") setDenied(true);
        else setError(messageFor(e));
      }
    })();
    if (isAuthor) loadShares();
  }, [scope, record.id, isAuthor, loadShares]);

  /* ------------------------------------------------- sem acesso */
  if (denied) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-[14px] bg-[var(--color-surface-2)] p-4">
          <IconLock
            width={18}
            height={18}
            className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]"
          />
          <div>
            <p className="text-sm font-medium">Evolução de outra profissional</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Sessão de {date(record.created_at)} · {author?.full_name ?? "—"}.
              Cada profissional vê apenas as próprias evoluções. Para ler esta,
              peça a {author?.full_name.split(" ")[0] ?? "ela"} para compartilhar
              com você.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (content === null) {
    return error ? (
      <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
        {error}
      </p>
    ) : (
      <div className="skeleton h-40 w-full" />
    );
  }

  const canShareWith = professionals.filter(
    (p) =>
      p.id !== scope.profile_id &&
      !shares.some((sh) => sh.shared_with === p.id),
  );

  return (
    <div className="space-y-4">
      {locked && (
        <p className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink-muted)]">
          <IconLock width={14} height={14} />
          Evolução assinada. Correções entram como adendo datado.
        </p>
      )}

      {!isAuthor && (
        <p className="rounded-lg bg-[var(--color-info-soft)] px-3 py-2 text-sm text-[var(--color-info)]">
          {author?.full_name ?? "A autora"} compartilhou esta evolução com você.
        </p>
      )}

      {isAuthor && !locked ? (
        <>
          {templates && templates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setDraft(draft ? `${draft}\n\n${t.body}` : t.body)}
                >
                  <IconPlus width={14} height={14} /> {t.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            rows={12}
            className="field"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
            aria-label="Conteúdo da evolução"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={async () => {
                try {
                  await repo.records.update(scope, record.id, { content: draft });
                  setSaved(true); setContent(draft); onChanged();
                } catch (e) { setError(messageFor(e)); }
              }}
            >
              {saved ? "Salvo" : "Salvar"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                try {
                  await repo.records.sign(scope, record.id);
                  setLocked(true); onChanged();
                } catch (e) { setError(messageFor(e)); }
              }}
            >
              <IconCheck width={15} height={15} /> Assinar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm ml-auto text-[var(--color-danger)]"
              onClick={async () => {
                await repo.records.remove(scope, record.id);
                onChanged();
                onClose();
              }}
            >
              Excluir evolução
            </button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      )}

      {/* --------------------------------------- compartilhamento */}
      {/* Só aparece quando há com quem compartilhar. Num consultório de
          uma profissional só, a seção inteira some. */}
      {isAuthor && professionals.length > 1 && (
        <section className="rounded-[14px] border border-[var(--color-line)] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Compartilhar evolução</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                Quem você escolher passa a poder ler esta evolução. Dá para
                revogar quando quiser.
              </p>
            </div>
            {!sharing && canShareWith.length > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-sm shrink-0"
                onClick={() => { setSharing(true); setShareWith(canShareWith[0]!.id); }}
              >
                <IconPlus width={14} height={14} />
                Compartilhar
              </button>
            )}
          </div>

          {sharing && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <span className="label">Com quem</span>
                <Select
                  label="Compartilhar com"
                  size="sm"
                  value={shareWith}
                  onChange={setShareWith}
                  options={canShareWith.map((p) => ({
                    value: p.id,
                    label: p.full_name,
                    hint: p.specialty ?? undefined,
                  }))}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  try {
                    await repo.records.share(scope, record.id, shareWith);
                    setSharing(false);
                    loadShares();
                  } catch (e) { setError(messageFor(e)); }
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSharing(false)}
              >
                Cancelar
              </button>
            </div>
          )}

          {shares.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {shares.map((sh) => {
                const person = professionals.find((p) => p.id === sh.shared_with);
                return (
                  <li
                    key={sh.id}
                    className="flex items-center gap-2 rounded-[9px] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {person?.full_name ?? "—"}
                    </span>
                    <span className="tabular shrink-0 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-subtle)]">
                      {date(sh.created_at)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Revogar acesso de ${person?.full_name ?? ""}`}
                      className="btn btn-ghost h-6 w-6 shrink-0 !px-0 text-[var(--color-danger)]"
                      onClick={async () => {
                        await repo.records.revokeShare(scope, sh.id);
                        loadShares();
                      }}
                    >
                      <IconX width={13} height={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

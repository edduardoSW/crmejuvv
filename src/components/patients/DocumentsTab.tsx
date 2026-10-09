"use client";

/**
 * Documentos do paciente — laudo, atestado, encaminhamento.
 * Ficam dentro do sistema (base64 no protótipo; Storage na fase 2).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { repo, messageFor } from "@/lib/repository";
import { date, time } from "@/lib/format";
import type { PatientDocument, Profile, Scope } from "@/lib/domain/types";
import { IconPlus, IconRecord, IconX } from "@/components/icons";

const MAX_BYTES = 900 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function kindOf(mime: string): { label: string; tone: [string, string] } {
  if (mime.startsWith("image/"))
    return { label: "Imagem", tone: ["var(--color-info-soft)", "var(--color-info)"] };
  if (mime === "application/pdf")
    return { label: "PDF", tone: ["var(--color-danger-soft)", "var(--color-danger)"] };
  if (mime.includes("word") || mime.includes("document"))
    return { label: "Documento", tone: ["var(--color-accent-soft)", "var(--color-accent-ink)"] };
  return { label: "Arquivo", tone: ["var(--color-surface-2)", "var(--color-ink-muted)"] };
}

export function DocumentsTab({
  scope,
  patientId,
  professionals,
}: {
  scope: Scope;
  patientId: string;
  professionals: Profile[];
}) {
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PatientDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setDocs(await repo.patients.listDocuments(scope, patientId));
  }, [scope, patientId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          if (file.size > MAX_BYTES) {
            setError(
              `"${file.name}" tem ${prettySize(file.size)}. Neste protótipo o limite é ${prettySize(MAX_BYTES)} por arquivo, os dados ficam no navegador.`,
            );
            continue;
          }
          const data = await readAsDataUrl(file);
          await repo.patients.addDocument(scope, patientId, {
            name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            data,
          });
        }
        load();
      } catch (e) {
        setError(messageFor(e));
      } finally {
        setBusy(false);
      }
    },
    [scope, patientId, load],
  );

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------- área de upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={`rounded-[16px] border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-line-strong)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Importar arquivos"
          onChange={(e) => upload(e.target.files)}
        />
        <p className="text-sm font-medium">
          {busy ? "Importando…" : "Arraste arquivos aqui"}
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Laudo, atestado, encaminhamento · até {prettySize(MAX_BYTES)} por arquivo
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <IconPlus width={15} height={15} />
          Escolher arquivos
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------ lista */}
      {docs.length === 0 ? (
        <div className="grid place-items-center py-8 text-center">
          <IconRecord width={22} height={22} className="mb-2 text-[var(--color-ink-subtle)]" />
          <p className="text-sm text-[var(--color-ink-muted)]">
            Nenhum documento importado.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const kind = kindOf(doc.mime_type);
            const author = professionals.find((p) => p.id === doc.uploaded_by);
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--color-line)] p-3"
              >
                <span
                  className="icon-chip text-[10px] font-medium"
                  style={{ background: kind.tone[0], color: kind.tone[1] }}
                  aria-hidden="true"
                >
                  {kind.label.slice(0, 3).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">
                    {prettySize(doc.size_bytes)} · {date(doc.created_at)}{" "}
                    {time(doc.created_at)} · {author?.full_name ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {doc.mime_type.startsWith("image/") && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPreview(doc)}
                    >
                      Ver
                    </button>
                  )}
                  <a
                    href={doc.data}
                    download={doc.name}
                    className="btn btn-ghost btn-sm"
                  >
                    Baixar
                  </a>
                  <button
                    type="button"
                    aria-label={`Excluir ${doc.name}`}
                    className="btn btn-ghost h-8 w-8 !px-0 text-[var(--color-danger)]"
                    onClick={async () => {
                      await repo.patients.deleteDocument(scope, doc.id);
                      load();
                    }}
                  >
                    <IconX width={14} height={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.data}
            alt={preview.name}
            className="max-h-full max-w-full rounded-[14px]"
          />
        </div>
      )}
    </div>
  );
}

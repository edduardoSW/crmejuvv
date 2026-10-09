"use client";

/**
 * Confirmação de ação destrutiva.
 *
 * Duas camadas, de propósito:
 *  1. o diálogo nomeia exatamente o que será afetado (nunca "tem certeza?");
 *  2. quando `confirmText` é passado, exige digitar a palavra — trava o clique
 *     automático em exclusões que não têm volta.
 */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { IconAlert } from "@/components/icons";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  /** Lista do que será apagado junto — a parte que as pessoas não esperam. */
  consequences,
  confirmLabel = "Excluir",
  /** Se informado, o botão só libera depois de digitar exatamente este texto. */
  confirmText,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  consequences?: string[];
  confirmLabel?: string;
  confirmText?: string;
  tone?: "danger" | "warn";
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const ready = !confirmText || typed.trim() === confirmText;
  const tones =
    tone === "danger"
      ? ["var(--color-danger-soft)", "var(--color-danger)"]
      : ["var(--color-warn-soft)", "var(--color-warn)"];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: tones[1], color: "#fff" }}
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Excluindo…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="flex gap-3 rounded-[14px] p-3.5"
          style={{ background: tones[0] }}
        >
          <IconAlert
            width={18}
            height={18}
            style={{ color: tones[1] }}
            className="mt-0.5 shrink-0"
          />
          <p className="text-sm">{description}</p>
        </div>

        {consequences && consequences.length > 0 && (
          <div>
            <p className="overline">O que será apagado junto</p>
            <ul className="mt-2 space-y-1 text-sm">
              {consequences.map((c) => (
                <li key={c} className="flex gap-2">
                  <span style={{ color: tones[1] }}>—</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirmText && (
          <div>
            <label className="label" htmlFor="confirm-text">
              Para confirmar, digite{" "}
              <strong className="font-[family-name:var(--font-mono)] text-[var(--color-ink)]">
                {confirmText}
              </strong>
            </label>
            <input
              id="confirm-text"
              className="field"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

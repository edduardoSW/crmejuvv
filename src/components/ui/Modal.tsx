"use client";

/**
 * Modal e Drawer com foco preso, retorno ao gatilho e fechamento por Esc.
 * docs/05-design-system.md §7.
 */

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/icons";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const node = ref.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener.current?.focus();
    };
  }, [open, onClose]);

  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: BaseProps & { size?: "sm" | "md" | "lg" }) {
  const ref = useDialog(open, onClose);
  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  if (!open || typeof document === "undefined") return null;

  const width =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={stop}
        className={`card rise-in flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-b-none sm:rounded-[20px]`}
      >
        <div className="flex items-start gap-4 border-b border-[var(--color-line)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2>{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="btn btn-ghost h-8 w-8 shrink-0 !px-0"
          >
            <IconX width={17} height={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: BaseProps) {
  const ref = useDialog(open, onClose);
  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={stop}
        className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]"
        style={{ animation: "riseIn 220ms var(--ease-out-expo) both" }}
      >
        <div className="flex items-start gap-4 border-b border-[var(--color-line)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate">{title}</h2>
            {description && (
              <p className="mt-0.5 truncate text-sm text-[var(--color-ink-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="btn btn-ghost h-8 w-8 shrink-0 !px-0"
          >
            <IconX width={17} height={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

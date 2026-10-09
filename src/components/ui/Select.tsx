"use client";

/**
 * Dropdown próprio — o `<select>` nativo é renderizado pelo sistema operacional
 * e ignora o tema (fundo branco no modo escuro, fonte do Windows).
 *
 * Acessível: role=listbox, navegação por setas, Home/End, Esc, busca por
 * digitação, e o foco volta ao gatilho ao fechar.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconChevronDown } from "@/components/icons";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Selecione",
  className = "",
  disabled,
  size = "md",
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Rótulo acessível — vira aria-label quando não há <label> visível. */
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const id = useId();

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));

    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, options, value, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelectorAll("li")
      [active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":
        close();
        break;
      default: {
        // Busca por digitação, como no select nativo.
        if (e.key.length !== 1) return;
        const now = Date.now();
        const text =
          now - typeahead.current.at > 700
            ? e.key.toLowerCase()
            : typeahead.current.text + e.key.toLowerCase();
        typeahead.current = { text, at: now };
        const found = options.findIndex((o) =>
          o.label.toLowerCase().startsWith(text),
        );
        if (found >= 0) setActive(found);
      }
    }
  }

  const height = size === "sm" ? "h-9" : "h-10";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`field ${height} flex items-center gap-2 pr-2 text-left ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "" : "text-[var(--color-ink-subtle)]"
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <IconChevronDown
          width={16}
          height={16}
          className={`shrink-0 text-[var(--color-ink-subtle)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className="card absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 min-w-full overflow-y-auto p-1"
          style={{ animation: "riseIn 140ms var(--ease-out-expo) both" }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(index)}
                className={`flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm ${
                  index === active ? "bg-[var(--color-surface-2)]" : ""
                } ${isSelected ? "font-medium" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-[var(--color-ink-subtle)]">
                      {option.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <IconCheck
                    width={15}
                    height={15}
                    className="shrink-0 text-[var(--color-accent)]"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

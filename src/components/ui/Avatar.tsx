"use client";

/**
 * Avatar com foto ou iniciais.
 *
 * Sem foto, a cor de fundo é derivada do nome — determinística, então a mesma
 * pessoa tem sempre a mesma cor, e a paleta é a do tema (rosé, dourado,
 * terrosos), nunca cor aleatória de template.
 */

import { initials } from "@/lib/format";

const PALETTE = [
  ["var(--color-accent-soft)", "var(--color-accent-ink)"],
  ["var(--color-gold-soft)", "var(--color-gold-ink)"],
  ["var(--color-info-soft)", "var(--color-info)"],
  ["var(--color-success-soft)", "var(--color-success)"],
  ["var(--color-warn-soft)", "var(--color-warn)"],
] as const;

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

const SIZES = {
  xs: { box: 28, text: "text-[10px]" },
  sm: { box: 36, text: "text-xs" },
  md: { box: 44, text: "text-sm" },
  lg: { box: 64, text: "text-lg" },
  xl: { box: 88, text: "text-2xl" },
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  square = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  square?: boolean;
}) {
  const { box, text } = SIZES[size];
  const [bg, fg] = PALETTE[hueOf(name)]!;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={box}
        height={box}
        className={`shrink-0 object-cover ${square ? "rounded-[14px]" : "rounded-full"}`}
        style={{ width: box, height: box }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-medium ${text} ${
        square ? "rounded-[14px]" : "rounded-full"
      }`}
      style={{ width: box, height: box, background: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Reduz a imagem antes de guardar: o localStorage tem ~5 MB e uma foto de
 * celular sozinha estoura isso (RNF-10). 256px e JPEG a 0.7 dão ~15 KB.
 */
export async function resizeImage(file: File, max = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", 0.7);
}

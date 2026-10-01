import type { CSSProperties } from "react";

import {
  contrastRatio,
  isHexColor,
  normalizeHexColor,
  readableForegroundColor,
  relativeLuminance,
} from "../lib/color.ts";
import { firstPartyImageDeliveryURL } from "../media/image.ts";

export interface PresentationThemeInput {
  title?: string;
  background?: {
    color?: string;
    image?: string;
    focal_x?: number;
    focal_y?: number;
    text_color?: string;
  };
  text_color?: string;
  accent_color?: string;
  visualization_palette?: readonly string[];
}

export type PresentationThemeSurface =
  | "stage"
  | "manager"
  | "participant"
  | "editor";

export type PresentationThemeOptions = {
  surface?: PresentationThemeSurface;
};

export type PresentationThemePreset = {
  id: string;
  label: string;
  description: string;
  background: string;
  foreground: string;
  accent: string;
  palette: readonly string[];
};

export const DEFAULT_PRESENTATION_BACKGROUND = "#f7f7fb";
export const DEFAULT_PRESENTATION_FOREGROUND = "#111827";
export const DEFAULT_PRESENTATION_ACCENT = "#8b5cf6";

export const DEFAULT_VISUALIZATION_PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
] as const;

export const PRESENTATION_THEME_PRESETS: readonly PresentationThemePreset[] = [
  {
    id: "minimal-light",
    label: "مینیمال روشن",
    description: "خنثی، روشن و مناسب ارائه‌های متنی",
    background: "#f8fafc",
    foreground: "#0f172a",
    accent: "#4f46e5",
    palette: ["#4f46e5", "#0891b2", "#059669", "#d97706", "#e11d48", "#7c3aed"],
  },
  {
    id: "indigo-stage",
    label: "نیلی",
    description: "کنتراست بالا برای اجرای زنده و پروژکتور",
    background: "#312e81",
    foreground: "#ffffff",
    accent: "#a78bfa",
    palette: ["#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa"],
  },
  {
    id: "deep-ocean",
    label: "دریایی",
    description: "تیره و آرام با تأکید فیروزه‌ای",
    background: "#083344",
    foreground: "#f8fafc",
    accent: "#22d3ee",
    palette: ["#22d3ee", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc"],
  },
  {
    id: "forest",
    label: "جنگلی",
    description: "تیره، رسمی و مناسب داده‌های زنده",
    background: "#052e16",
    foreground: "#f0fdf4",
    accent: "#34d399",
    palette: ["#34d399", "#22d3ee", "#a3e635", "#fbbf24", "#fb7185", "#818cf8"],
  },
  {
    id: "warm-stage",
    label: "گرم",
    description: "گرم و پرانرژی بدون قربانی‌کردن خوانایی",
    background: "#7c2d12",
    foreground: "#fff7ed",
    accent: "#fb923c",
    palette: ["#fb923c", "#facc15", "#4ade80", "#22d3ee", "#f472b6", "#a78bfa"],
  },
  {
    id: "graphite",
    label: "گرافیتی",
    description: "خنثی و تاریک برای محیط‌های کم‌نور",
    background: "#18181b",
    foreground: "#fafafa",
    accent: "#38bdf8",
    palette: ["#38bdf8", "#818cf8", "#2dd4bf", "#facc15", "#fb7185", "#c084fc"],
  },
] as const;

export const normalizeVisualizationPalette = (
  value: unknown,
  fallback: readonly string[] = DEFAULT_VISUALIZATION_PALETTE,
): string[] => {
  if (!Array.isArray(value)) return [...fallback];

  const colors = value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => isHexColor(item))
    .slice(0, 8);

  return colors.length >= 3 ? colors : [...fallback];
};

export const presentationContrastRatio = (
  first: string,
  second: string,
): number => {
  return contrastRatio(first, second);
};

const readableForeground = (
  background: string,
  requestedForeground: string,
): string => {
  if (presentationContrastRatio(background, requestedForeground) >= 4.5) {
    return requestedForeground;
  }

  return readableForegroundColor(background);
};

const normalizeFocalPoint = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0.5;

const presentationColorHash = (value: string | number): number => {
  const input = String(value);
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const presentationVisualizationColor = (
  key: string | number,
): string => {
  const index = presentationColorHash(key) % 8;
  const fallback =
    DEFAULT_VISUALIZATION_PALETTE[
      index % DEFAULT_VISUALIZATION_PALETTE.length
    ];
  return `var(--live-palette-${index + 1}, ${fallback})`;
};

export const findPresentationThemePreset = (input: {
  background: string;
  foreground: string;
  accent: string;
  palette: readonly string[];
}): PresentationThemePreset | null => {
  const palette = normalizeVisualizationPalette(input.palette);

  return (
    PRESENTATION_THEME_PRESETS.find(
      (preset) =>
        preset.background === input.background.toLowerCase() &&
        preset.foreground === input.foreground.toLowerCase() &&
        preset.accent === input.accent.toLowerCase() &&
        preset.palette.length === palette.length &&
        preset.palette.every(
          (color, index) => color === palette[index],
        ),
    ) ?? null
  );
};

export const presentationTheme = (
  input?: PresentationThemeInput,
  options: PresentationThemeOptions = {},
) => {
  const surface = options.surface ?? "stage";
  const background = normalizeHexColor(
    input?.background?.color,
    DEFAULT_PRESENTATION_BACKGROUND,
  );
  const requestedForeground = normalizeHexColor(
    input?.text_color ?? input?.background?.text_color,
    DEFAULT_PRESENTATION_FOREGROUND,
  );
  const foreground = readableForeground(
    background,
    requestedForeground,
  );
  const accent = normalizeHexColor(
    input?.accent_color,
    DEFAULT_PRESENTATION_ACCENT,
  );
  const palette = normalizeVisualizationPalette(
    input?.visualization_palette,
  );
  const image = input?.background?.image?.trim() ?? "";
  const deliveredImage =
    surface === "editor"
      ? firstPartyImageDeliveryURL(image, "medium")
      : firstPartyImageDeliveryURL(image, "large");
  const focalX = normalizeFocalPoint(input?.background?.focal_x);
  const focalY = normalizeFocalPoint(input?.background?.focal_y);
  const showsBackgroundImage =
    image.length > 0 && surface !== "participant";
  const foregroundIsLight = relativeLuminance(foreground) > 0.45;
  const contrastTarget = foregroundIsLight ? "#000000" : "#ffffff";
  const imageOverlay =
    surface === "manager"
      ? foregroundIsLight
        ? "rgba(0,0,0,.58)"
        : "rgba(255,255,255,.72)"
      : foregroundIsLight
        ? "rgba(0,0,0,.46)"
        : "rgba(255,255,255,.62)";
  const decorativeBackground =
    `radial-gradient(circle at 15% 10%, color-mix(in srgb, ${accent} 18%, transparent), transparent 32%), linear-gradient(145deg, ${background}, color-mix(in srgb, ${background} 90%, ${contrastTarget}))`;

  return {
    background,
    foreground,
    accent,
    palette,
    surface,
    contrastRatio: presentationContrastRatio(background, foreground),
    image,
    focalX,
    focalY,
    hasBackgroundImage: image.length > 0,
    showsBackgroundImage,
    style: {
      "--live-bg": background,
      "--live-fg": foreground,
      "--live-muted": `color-mix(in srgb, ${foreground} 78%, transparent)`,
      "--live-border": `color-mix(in srgb, ${foreground} 20%, transparent)`,
      "--live-control-border": `color-mix(in srgb, ${foreground} 50%, transparent)`,
      "--live-focus": `color-mix(in srgb, ${foreground} 78%, transparent)`,
      "--live-focus-soft": `color-mix(in srgb, ${foreground} 30%, transparent)`,
      "--live-surface": `color-mix(in srgb, ${background} 78%, ${contrastTarget} 22%)`,
      "--live-overlay-subtle": `color-mix(in srgb, ${foreground} 5%, transparent)`,
      "--live-overlay-soft": `color-mix(in srgb, ${foreground} 10%, transparent)`,
      "--live-overlay-medium": `color-mix(in srgb, ${foreground} 18%, transparent)`,
      "--live-overlay-strong": `color-mix(in srgb, ${foreground} 28%, transparent)`,
      "--live-contrast-soft": `color-mix(in srgb, ${contrastTarget} 20%, transparent)`,
      "--live-contrast-medium": `color-mix(in srgb, ${contrastTarget} 35%, transparent)`,
      "--live-contrast-strong": `color-mix(in srgb, ${contrastTarget} 55%, transparent)`,
      "--live-control-bg": foreground,
      "--live-control-fg": contrastTarget,
      "--live-input-bg": `color-mix(in srgb, ${foreground} 95%, transparent)`,
      "--live-input-border": `color-mix(in srgb, ${foreground} 20%, transparent)`,
      "--live-input-placeholder": `color-mix(in srgb, ${contrastTarget} 58%, transparent)`,
      "--live-accent": accent,
      "--live-accent-soft": `color-mix(in srgb, ${accent} 22%, transparent)`,
      "--live-palette-1": palette[0 % palette.length],
      "--live-palette-2": palette[1 % palette.length],
      "--live-palette-3": palette[2 % palette.length],
      "--live-palette-4": palette[3 % palette.length],
      "--live-palette-5": palette[4 % palette.length],
      "--live-palette-6": palette[5 % palette.length],
      "--live-palette-7": palette[6 % palette.length],
      "--live-palette-8": palette[7 % palette.length],
      backgroundColor: background,
      backgroundImage: showsBackgroundImage
        ? `linear-gradient(${imageOverlay}, ${imageOverlay}), url(${JSON.stringify(deliveredImage)})`
        : decorativeBackground,
      ...(showsBackgroundImage
        ? {
            backgroundPosition:
              `center, ${focalX * 100}% ${focalY * 100}%`,
            backgroundSize: "cover, cover",
            backgroundRepeat: "no-repeat, no-repeat",
          }
        : {}),
    } as CSSProperties,
  };
};

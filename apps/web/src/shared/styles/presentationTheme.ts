import type { CSSProperties } from "react";

export interface PresentationThemeInput {
  title?: string;
  background?: {
    color?: string;
    image?: string;
    text_color?: string;
  };
  text_color?: string;
  accent_color?: string;
  visualization_palette?: readonly string[];
}

export type PresentationThemePreset = {
  id: string;
  label: string;
  description: string;
  background: string;
  foreground: string;
  accent: string;
  palette: readonly string[];
};

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

const HEX = /^#[0-9a-f]{6}$/i;

const normalizeHex = (value: unknown, fallback: string): string => {
  const candidate = String(value ?? "").trim();
  return HEX.test(candidate) ? candidate.toLowerCase() : fallback;
};

export const normalizeVisualizationPalette = (
  value: unknown,
  fallback: readonly string[] = DEFAULT_VISUALIZATION_PALETTE,
): string[] => {
  if (!Array.isArray(value)) return [...fallback];

  const colors = value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => HEX.test(item))
    .slice(0, 8);

  return colors.length >= 3 ? colors : [...fallback];
};

const luminance = (hex: string) => {
  const channels = [1, 3, 5]
    .map(
      (start) =>
        Number.parseInt(hex.slice(start, start + 2), 16) / 255,
    )
    .map((value) =>
      value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
};

export const presentationContrastRatio = (
  first: string,
  second: string,
): number => {
  const safeFirst = normalizeHex(first, "#000000");
  const safeSecond = normalizeHex(second, "#ffffff");
  const [light, dark] = [
    luminance(safeFirst),
    luminance(safeSecond),
  ].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
};

const readableForeground = (
  background: string,
  requestedForeground: string,
): string => {
  if (presentationContrastRatio(background, requestedForeground) >= 4.5) {
    return requestedForeground;
  }

  return presentationContrastRatio(background, "#ffffff") >=
    presentationContrastRatio(background, "#0f172a")
    ? "#ffffff"
    : "#0f172a";
};

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
) => {
  const background = normalizeHex(
    input?.background?.color,
    "#312e81",
  );
  const requestedForeground = normalizeHex(
    input?.text_color ?? input?.background?.text_color,
    "#ffffff",
  );
  const foreground = readableForeground(
    background,
    requestedForeground,
  );
  const accent = normalizeHex(
    input?.accent_color,
    DEFAULT_PRESENTATION_ACCENT,
  );
  const palette = normalizeVisualizationPalette(
    input?.visualization_palette,
  );
  const image = input?.background?.image?.trim() ?? "";
  const foregroundIsLight = luminance(foreground) > 0.45;
  const contrastTarget = foregroundIsLight ? "#000000" : "#ffffff";
  const imageOverlay = foregroundIsLight
    ? "rgba(0,0,0,.46)"
    : "rgba(255,255,255,.62)";

  return {
    background,
    foreground,
    accent,
    palette,
    contrastRatio: presentationContrastRatio(background, foreground),
    image,
    style: {
      "--live-bg": background,
      "--live-fg": foreground,
      "--live-muted": `color-mix(in srgb, ${foreground} 78%, transparent)`,
      "--live-border": `color-mix(in srgb, ${foreground} 20%, transparent)`,
      "--live-surface": `color-mix(in srgb, ${background} 78%, ${contrastTarget} 22%)`,
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
      backgroundImage: image
        ? `linear-gradient(${imageOverlay}, ${imageOverlay}), url(${JSON.stringify(image)})`
        : `radial-gradient(circle at 15% 10%, color-mix(in srgb, ${accent} 18%, transparent), transparent 32%), linear-gradient(145deg, ${background}, color-mix(in srgb, ${background} 90%, ${contrastTarget}))`,
    } as CSSProperties,
  };
};

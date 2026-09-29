export type WordCloudDisplayMode = "embedded" | "projection";

export type WordCloudTerm = {
  text: string;
  count: number;
};

type PositionedWordCloudTerm = WordCloudTerm & {
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type DisplayProfile = {
  minFontSize: number;
  maxFontSize: number;
  candidateLimit: number;
  horizontalPadding: number;
  verticalPadding: number;
  textColorMix: number;
};

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 560;
export const WORD_CLOUD_VIEWBOX = {
  width: VIEWBOX_WIDTH,
  height: VIEWBOX_HEIGHT,
} as const;
const WORD_CLOUD_FONT_FAMILY = 'Vazirmatn, "Segoe UI", sans-serif';
export const WORD_CLOUD_FONT_WEIGHT = 700;

const DISPLAY_PROFILES: Record<WordCloudDisplayMode, DisplayProfile> = {
  embedded: {
    minFontSize: 22,
    maxFontSize: 80,
    candidateLimit: 100,
    horizontalPadding: 16,
    verticalPadding: 16,
    textColorMix: 82,
  },
  projection: {
    minFontSize: 32,
    maxFontSize: 96,
    candidateLimit: 72,
    horizontalPadding: 24,
    verticalPadding: 22,
    textColorMix: 88,
  },
};

const ACCENTS = [
  "var(--live-palette-1, #8b5cf6)",
  "var(--live-palette-2, #06b6d4)",
  "var(--live-palette-3, #10b981)",
  "var(--live-palette-4, #f59e0b)",
  "var(--live-palette-5, #ec4899)",
  "var(--live-palette-6, #3b82f6)",
  "var(--live-palette-7, #8b5cf6)",
  "var(--live-palette-8, #06b6d4)",
] as const;

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const intersects = (left: Rect, right: Rect): boolean =>
  !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );

const fallbackTextWidth = (text: string, fontSize: number): number => {
  const glyphCount = Math.max(1, Array.from(text).length);
  return Math.max(fontSize * 1.4, glyphCount * fontSize * 0.62);
};

const createTextMeasurer = (): ((text: string, fontSize: number) => number) => {
  if (
    typeof document === "undefined" ||
    typeof CanvasRenderingContext2D === "undefined"
  ) {
    return fallbackTextWidth;
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return fallbackTextWidth;

    return (text, fontSize) => {
      context.font = `${WORD_CLOUD_FONT_WEIGHT} ${fontSize}px ${WORD_CLOUD_FONT_FAMILY}`;
      const measured = context.measureText(text).width;
      return Number.isFinite(measured) && measured > 0
        ? measured
        : fallbackTextWidth(text, fontSize);
    };
  } catch {
    return fallbackTextWidth;
  }
};

const rectFor = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
  measureText: (text: string, fontSize: number) => number,
): Rect => {
  const estimatedWidth = Math.min(
    VIEWBOX_WIDTH * 0.92,
    measureText(text, fontSize),
  );
  const estimatedHeight = fontSize * 1.18;
  const padding = Math.max(6, fontSize * 0.1);

  return {
    left: x - estimatedWidth / 2 - padding,
    right: x + estimatedWidth / 2 + padding,
    top: y - estimatedHeight / 2 - padding,
    bottom: y + estimatedHeight / 2 + padding,
  };
};

const insideViewBox = (rect: Rect, profile: DisplayProfile): boolean =>
  rect.left >= profile.horizontalPadding &&
  rect.right <= VIEWBOX_WIDTH - profile.horizontalPadding &&
  rect.top >= profile.verticalPadding &&
  rect.bottom <= VIEWBOX_HEIGHT - profile.verticalPadding;

const termColor = (text: string, profile: DisplayProfile): string => {
  const accent = ACCENTS[hashText(text) % ACCENTS.length];
  return `color-mix(in srgb, currentColor ${profile.textColorMix}%, ${accent})`;
};

export const layoutWordCloudTerms = (
  input: readonly WordCloudTerm[],
  displayMode: WordCloudDisplayMode = "embedded",
): PositionedWordCloudTerm[] => {
  const profile = DISPLAY_PROFILES[displayMode];
  const terms = input
    .filter(
      (term) =>
        term.text.trim() &&
        Number.isFinite(term.count) &&
        term.count > 0,
    )
    .map((term) => ({
      text: term.text.trim(),
      count: Math.max(1, Math.round(term.count)),
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.text.localeCompare(right.text, "fa"),
    )
    .slice(0, profile.candidateLimit);

  if (!terms.length) return [];

  const maxCount = Math.max(...terms.map((term) => term.count));
  const minCount = Math.min(...terms.map((term) => term.count));
  const minRoot = Math.sqrt(minCount);
  const range = Math.max(0.0001, Math.sqrt(maxCount) - minRoot);
  const occupied: Rect[] = [];
  const placed: PositionedWordCloudTerm[] = [];
  const measureText = createTextMeasurer();
  const equalFrequencyWeight =
    terms.length <= 12 ? 0.55 : terms.length <= 32 ? 0.35 : 0.18;

  for (const term of terms) {
    const weight =
      maxCount === minCount
        ? equalFrequencyWeight
        : (Math.sqrt(term.count) - minRoot) / range;
    const baseFontSize = Math.round(
      profile.minFontSize +
        weight * (profile.maxFontSize - profile.minFontSize),
    );
    const measuredAtBase = measureText(term.text, baseFontSize);
    const widthBound =
      measuredAtBase > VIEWBOX_WIDTH * 0.82
        ? Math.max(
            profile.minFontSize,
            Math.floor(
              (baseFontSize * VIEWBOX_WIDTH * 0.82) / measuredAtBase,
            ),
          )
        : baseFontSize;
    const fontSize = Math.min(baseFontSize, widthBound);
    const phase = ((hashText(term.text) % 360) * Math.PI) / 180;

    let resolved: { x: number; y: number; rect: Rect } | null = null;
    for (let step = 0; step < 1200; step += 1) {
      const radius = step === 0 ? 0 : 3.65 * Math.sqrt(step);
      const angle = phase + step * 0.43;
      const x = VIEWBOX_WIDTH / 2 + Math.cos(angle) * radius * 1.52;
      const y = VIEWBOX_HEIGHT / 2 + Math.sin(angle) * radius;
      const rect = rectFor(term.text, x, y, fontSize, measureText);

      if (!insideViewBox(rect, profile)) continue;
      if (occupied.some((item) => intersects(item, rect))) continue;

      resolved = { x, y, rect };
      break;
    }

    if (!resolved) continue;
    occupied.push(resolved.rect);
    placed.push({
      ...term,
      x: resolved.x,
      y: resolved.y,
      fontSize,
      color: termColor(term.text, profile),
    });
  }

  return placed;
};

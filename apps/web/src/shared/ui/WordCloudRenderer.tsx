import { useMemo } from "react";

type WordCloudTerm = {
  text: string;
  count: number;
};

type Props = {
  terms: readonly WordCloudTerm[];
  className?: string;
  emptyLabel?: string;
  ariaLabel?: string;
};

type PositionedTerm = WordCloudTerm & {
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
};

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 560;
const MAX_RENDERED_TERMS = 80;

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

const rectFor = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
): Rect => {
  const glyphCount = Math.max(1, Array.from(text).length);
  const estimatedWidth = Math.min(
    VIEWBOX_WIDTH * 0.9,
    Math.max(fontSize * 1.4, glyphCount * fontSize * 0.62),
  );
  const estimatedHeight = fontSize * 1.12;
  const padding = Math.max(5, fontSize * 0.08);

  return {
    left: x - estimatedWidth / 2 - padding,
    right: x + estimatedWidth / 2 + padding,
    top: y - estimatedHeight / 2 - padding,
    bottom: y + estimatedHeight / 2 + padding,
  };
};

const insideViewBox = (rect: Rect): boolean =>
  rect.left >= 16 &&
  rect.right <= VIEWBOX_WIDTH - 16 &&
  rect.top >= 16 &&
  rect.bottom <= VIEWBOX_HEIGHT - 16;

const layoutWordCloudTerms = (
  input: readonly WordCloudTerm[],
): PositionedTerm[] => {
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
    .slice(0, MAX_RENDERED_TERMS);

  if (!terms.length) return [];

  const maxCount = Math.max(...terms.map((term) => term.count));
  const minCount = Math.min(...terms.map((term) => term.count));
  const minRoot = Math.sqrt(minCount);
  const range = Math.max(0.0001, Math.sqrt(maxCount) - minRoot);
  const occupied: Rect[] = [];
  const placed: PositionedTerm[] = [];

  for (const term of terms) {
    const weight =
      maxCount === minCount
        ? 0.55
        : (Math.sqrt(term.count) - minRoot) / range;
    const baseFontSize = Math.round(24 + weight * 62);
    const glyphCount = Math.max(1, Array.from(term.text).length);
    const lengthBound = Math.max(
      22,
      Math.floor((VIEWBOX_WIDTH * 0.78) / (glyphCount * 0.62)),
    );
    const fontSize = Math.min(baseFontSize, lengthBound);
    const opacity = 0.72 + weight * 0.28;
    const phase = ((hashText(term.text) % 360) * Math.PI) / 180;

    let resolved: { x: number; y: number; rect: Rect } | null = null;
    for (let step = 0; step < 1100; step += 1) {
      const radius = step === 0 ? 0 : 3.7 * Math.sqrt(step);
      const angle = phase + step * 0.43;
      const x = VIEWBOX_WIDTH / 2 + Math.cos(angle) * radius * 1.52;
      const y = VIEWBOX_HEIGHT / 2 + Math.sin(angle) * radius;
      const rect = rectFor(term.text, x, y, fontSize);

      if (!insideViewBox(rect)) continue;
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
      opacity,
    });
  }

  return placed;
};

export default function WordCloudRenderer({
  terms,
  className = "",
  emptyLabel = "هنوز پاسخی برای نمایش وجود ندارد.",
  ariaLabel = "ابر واژه",
}: Props) {
  const positioned = useMemo(() => layoutWordCloudTerms(terms), [terms]);

  if (!positioned.length) {
    return (
      <div
        className={
          "grid min-h-40 place-items-center rounded-3xl border border-current/10 bg-current/5 px-6 text-center text-sm opacity-70 " +
          className
        }
        role="status"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={"relative w-full overflow-hidden " + className}
      aria-label={ariaLabel}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-full min-h-56 w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        {positioned.map((term) => (
          <text
            key={term.text}
            x={term.x}
            y={term.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={term.fontSize}
            fontWeight={800}
            opacity={term.opacity}
            className="fill-current"
          >
            {term.text}
          </text>
        ))}
      </svg>

      <ul className="sr-only" aria-label="فراوانی پاسخ‌های ابر واژه">
        {positioned.map((term) => (
          <li key={term.text}>
            {term.text}: {term.count.toLocaleString("fa-IR")}
          </li>
        ))}
      </ul>
    </div>
  );
}

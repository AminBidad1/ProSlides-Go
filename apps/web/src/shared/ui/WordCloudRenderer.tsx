import { useMemo } from "react";

import {
  layoutWordCloudTerms,
  type WordCloudDisplayMode,
  type WordCloudTerm,
  WORD_CLOUD_FONT_WEIGHT,
  WORD_CLOUD_VIEWBOX,
} from "./wordCloudLayout.ts";

type Props = {
  terms: readonly WordCloudTerm[];
  className?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  displayMode?: WordCloudDisplayMode;
};

export default function WordCloudRenderer({
  terms,
  className = "",
  emptyLabel = "هنوز پاسخی برای نمایش وجود ندارد.",
  ariaLabel = "ابر واژه",
  displayMode = "embedded",
}: Props) {
  const positioned = useMemo(
    () => layoutWordCloudTerms(terms, displayMode),
    [displayMode, terms],
  );

  if (!positioned.length) {
    const emptyShape =
      displayMode === "projection" ? "rounded-projection" : "rounded-panel";

    return (
      <div
        className={
          `grid min-h-40 place-items-center ${emptyShape} border border-current/10 bg-current/5 px-6 text-center text-sm opacity-70 ` +
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
      data-word-cloud-mode={displayMode}
    >
      <svg
        viewBox={`0 0 ${WORD_CLOUD_VIEWBOX.width} ${WORD_CLOUD_VIEWBOX.height}`}
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
            fontWeight={WORD_CLOUD_FONT_WEIGHT}
            className="fill-current"
            style={{ fill: term.color }}
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

import { lazy, Suspense } from "react";

type WordCloudTerm = {
  text: string;
  count: number;
};

type WordCloudViewProps = {
  terms: readonly WordCloudTerm[];
  className?: string;
  emptyLabel?: string;
  ariaLabel?: string;
};

const WordCloudRenderer = lazy(() => import("./WordCloudRenderer.tsx"));

export function WordCloudView({
  terms,
  className = "",
  emptyLabel = "هنوز پاسخی برای نمایش وجود ندارد.",
  ariaLabel = "ابر واژه",
}: WordCloudViewProps) {
  return (
    <Suspense
      fallback={
        <div
          className={
            "grid min-h-40 place-items-center rounded-3xl border border-current/10 bg-current/5 px-6 text-center text-sm opacity-70 " +
            className
          }
          role="status"
          aria-label={ariaLabel}
        >
          در حال آماده‌سازی ابر واژه…
        </div>
      }
    >
      <WordCloudRenderer
        terms={terms}
        className={className}
        emptyLabel={emptyLabel}
        ariaLabel={ariaLabel}
      />
    </Suspense>
  );
}

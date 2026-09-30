import { useMemo } from "react";
import { Cloud, Clock3, MessageCircleMore } from "lucide-react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { ImagePlacementImage } from "../../../../shared/media/ImagePlacementImage.tsx";
import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import { WordCloudView } from "../../../../shared/ui/WordCloudView.tsx";
import type { EditorSlide } from "../../model/editor.ts";
import { createWordCloudDraft } from "../model/wordCloudDraft.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import { useOptionalWordCloudDraft } from "../model/useWordCloudDraftContext.ts";

type WordCloudCanvasProps = {
  slide: EditorSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  quizBackgroundFocalX?: number;
  quizBackgroundFocalY?: number;
  textColor?: string;
  accentColor?: string;
  visualizationPalette?: string[];
};

const previewTerms = [
  { text: "خلاقیت", count: 12 },
  { text: "یادگیری", count: 9 },
  { text: "تعامل", count: 8 },
  { text: "هوش مصنوعی", count: 7 },
  { text: "همکاری", count: 6 },
  { text: "ایده تازه", count: 5 },
  { text: "تمرکز", count: 4 },
  { text: "انرژی", count: 3 },
  { text: "کار تیمی", count: 3 },
  { text: "بازخورد", count: 2 },
  { text: "تجربه", count: 2 },
] as const;

export default function WordCloudCanvas({
  slide,
  quizBackground,
  quizBackgroundImage,
  quizBackgroundFocalX = 0.5,
  quizBackgroundFocalY = 0.5,
  textColor = "#111827",
  accentColor = "#8b5cf6",
  visualizationPalette,
}: WordCloudCanvasProps) {
  const designController = useOptionalDesignDraft();
  const controller = useOptionalWordCloudDraft();
  const persistedDraft = useMemo(() => createWordCloudDraft(slide), [slide]);
  const draft =
    controller?.draft?.slideId === slide.slide_id
      ? controller.draft
      : persistedDraft;

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color: designController?.draft.backgroundColor ?? quizBackground,
          image:
            designController?.draft.backgroundImageUrl ?? quizBackgroundImage,
          focal_x:
            designController?.draft.backgroundImageFocalX ??
            quizBackgroundFocalX,
          focal_y:
            designController?.draft.backgroundImageFocalY ??
            quizBackgroundFocalY,
          text_color: designController?.draft.textColor ?? textColor,
        },
        text_color: designController?.draft.textColor ?? textColor,
        accent_color: designController?.draft.accentColor ?? accentColor,
        visualization_palette:
          designController?.draft.visualizationPalette ?? visualizationPalette,
      }, { surface: "editor" }),
    [
      designController?.draft.backgroundColor,
      designController?.draft.backgroundImageUrl,
      designController?.draft.backgroundImageFocalX,
      designController?.draft.backgroundImageFocalY,
      designController?.draft.textColor,
      designController?.draft.accentColor,
      designController?.draft.visualizationPalette,
      accentColor,
      visualizationPalette,
      quizBackground,
      quizBackgroundImage,
      quizBackgroundFocalX,
      quizBackgroundFocalY,
      textColor,
    ],
  );

  if (!draft) return null;

  return (
    <section
      aria-label="پیش‌نمایش ابر واژه"
      className="relative flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[color:var(--live-border)] bg-cover bg-center text-[color:var(--live-fg)] shadow-lg"
      style={theme.style}
    >
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5 backdrop-blur-md">
            <Cloud className="size-3.5" aria-hidden="true" />
            ابر واژه
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5">
              <MessageCircleMore className="size-3.5" aria-hidden="true" />
              تا {formatPersianNumber(draft.maxWords)} عبارت
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatPersianNumber(draft.durationSeconds)} ثانیه
            </span>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">
            پیش‌نمایش نتیجه روی نمایشگر
          </p>
          {draft.title ? (
            <p
              dir="auto"
              className="mt-2 text-sm font-bold text-[color:var(--live-muted)]"
            >
              {draft.title}
            </p>
          ) : null}
          <h2
            dir="auto"
            className="mt-2 whitespace-pre-wrap text-3xl font-black leading-[1.5] sm:text-4xl"
          >
            {draft.prompt || "پرسش ابر واژه اینجا نمایش داده می‌شود"}
          </h2>

          {draft.image.url ? (
            <ImagePlacementImage
              image={draft.image}
              preferred="medium"
              alt={draft.image.altText || "تصویر پرسش ابر واژه"}
              className="mt-4 max-h-32 max-w-full rounded-2xl object-contain"
            />
          ) : null}

          <WordCloudView
            terms={previewTerms}
            className="mt-6 min-h-48 w-full rounded-3xl border border-[color:var(--live-border)] bg-black/15 p-3"
            emptyLabel="پیش‌نمایشی برای نمایش وجود ندارد."
            displayMode="projection"
          />

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[color:var(--live-muted)]">
            هر عبارت کوتاه یک entry مستقل است و فراوانی بیشتر با اندازه بزرگ‌تر
            نمایش داده می‌شود؛ عبارت تکراری در پاسخ یک شرکت‌کننده دوباره شمرده نمی‌شود.
          </p>
        </div>

        {(controller?.dirty || designController?.dirty) && (
          <footer className="border-t border-[color:var(--live-border)] pt-3 text-xs font-bold text-warning-ink">
            تغییرات ذخیره‌نشده در پیش‌نمایش نمایش داده می‌شوند.
          </footer>
        )}
      </div>
    </section>
  );
}

import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyContentSlide } from "../../model/serverData.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { LiveMediaImage } from "../../ui/LiveMediaImage.tsx";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantContentSlideProps = {
  quiz: LivePresentationModel;
  content: LegacyContentSlide;
};

export function ParticipantContentSlide({
  quiz,
  content,
}: ParticipantContentSlideProps) {
  const { isConnected, isStreamConnected, connectionError } = useLiveSession();
  const title = content.title || "مطلب بعدی";
  const text = content.content_text || "";
  const image = content.content_image;
  const imageUrl = content.content_image_url || "";

  return (
    <ParticipantShell quiz={quiz}>
      <article className="flex flex-1 flex-col justify-center py-5 text-center">
        <div className="live-panel rounded-showcase p-5  sm:p-9">
          <p className="mb-3 text-sm font-bold text-[color:var(--live-muted)]">
            اسلاید توضیحی
          </p>
          <h1
            className="text-3xl font-black leading-tight sm:text-4xl"
            dir="auto"
          >
            {title}
          </h1>

          {imageUrl ? (
            <LiveMediaImage
              src={imageUrl}
              image={image}
              preferred="medium"
              alt={title ? "تصویر " + title : "تصویر اسلاید توضیحی"}
              className="mx-auto mt-6 max-h-[42dvh] w-auto max-w-full rounded-card border border-[color:var(--live-border)] object-contain shadow-card"
            />
          ) : null}

          {text ? (
            <p
              className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[color:var(--live-muted)]"
              dir="auto"
            >
              {text}
            </p>
          ) : null}

          <div
            className="mx-auto mt-7 inline-flex max-w-xl rounded-card border border-[color:var(--live-border)] live-theme-overlay-soft px-4 py-2 text-sm font-bold leading-6"
            role="status"
          >
            منتظر مرحله بعدی ارائه‌دهنده بمانید
          </div>

          {!isStreamConnected && connectionError ? (
            <p
              className="mx-auto mt-3 max-w-xl rounded-control border border-warning/30 bg-warning/10 px-4 py-2 text-sm leading-6 text-[color:var(--live-muted)]"
              role="status"
              aria-live="polite"
            >
              {isConnected
                ? "به‌روزرسانی زنده در حال بازیابی است؛ همین اسلاید معتبر است."
                : "ارتباط زنده در حال بازیابی است؛ همین اسلاید روی صفحه حفظ می‌شود."}
            </p>
          ) : null}
        </div>
      </article>
    </ParticipantShell>
  );
}

import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { LiveMediaImage } from "../../ui/LiveMediaImage.tsx";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantActivityClosedProps = {
  quiz: LivePresentationModel;
  question?: LegacyQuestionSlide | null;
  hasResponded: boolean;
};

export function ParticipantActivityClosed({
  quiz,
  question,
  hasResponded,
}: ParticipantActivityClosedProps) {
  const { isStreamConnected } = useLiveSession();
  const activityLabel =
    question?.activity_kind === "text"
      ? "فعالیت متنی"
      : question?.has_correct_answer === false
        ? "نظرسنجی"
        : "سؤال";

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <section className="flex flex-1 items-center justify-center py-5 text-center">
        <div className="w-full live-panel rounded-showcase p-5  sm:p-8">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">
            پاسخ‌گویی پایان یافت
          </p>
          <h1
            className="mx-auto mt-2 max-w-2xl text-2xl font-black leading-10 sm:text-3xl"
            dir="auto"
          >
            {question?.question_text || "این فعالیت به پایان رسید"}
          </h1>

          {question?.image_url ? (
            <LiveMediaImage
              src={question?.image_url}
              image={question?.image}
              preferred="medium"
              alt={"تصویر " + activityLabel}
              className="mx-auto mt-5 max-h-[28dvh] max-w-full rounded-card border border-[color:var(--live-border)] object-contain shadow-lg"
            />
          ) : null}

          <div
            className={
              "mx-auto mt-6 max-w-xl rounded-feature border px-5 py-5 " +
              (hasResponded
                ? "border-success/40 bg-success/15"
                : "border-[color:var(--live-border)] live-theme-overlay-subtle")
            }
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              className={
                "mx-auto grid h-12 w-12 place-items-center rounded-full border text-xl font-black " +
                (hasResponded
                  ? "border-success/50 bg-success/20"
                  : "border-[color:var(--live-border)] live-theme-overlay-soft")
              }
              aria-hidden="true"
            >
              {hasResponded ? "✓" : "…"}
            </div>
            <p className="mt-3 text-lg font-black">
              {hasResponded
                ? "پاسخ شما ثبت شده است"
                : "پاسخی از شما ثبت نشده است"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">
              {hasResponded
                ? "نتیجه هنوز نمایش داده نشده است."
                : "زمان پاسخ‌گویی تمام شده است."}
            </p>
          </div>

          <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[color:var(--live-muted)]">
            ارائه‌دهنده نتیجه را نمایش خواهد داد و این صفحه خودکار به‌روزرسانی می‌شود. نیازی به تازه‌سازی نیست.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}

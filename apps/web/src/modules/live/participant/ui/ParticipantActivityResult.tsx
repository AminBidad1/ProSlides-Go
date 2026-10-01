import { useMemo } from "react";

import { WordCloudView } from "../../../../shared/ui/WordCloudView.tsx";
import type { LivePresentationModel } from "../../model/presentation.ts";
import type {
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../../model/serverData.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { LiveMediaImage } from "../../ui/LiveMediaImage.tsx";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantActivityResultProps = {
  quiz: LivePresentationModel;
  question: LegacyQuestionSlide;
  result: LegacyQuestionResult | null;
};

export function ParticipantActivityResult({
  quiz,
  question,
  result,
}: ParticipantActivityResultProps) {
  const { isStreamConnected, snapshot } = useLiveSession();
  const participant =
    snapshot?.role === "participant" ? snapshot.participant : null;
  const personalResult =
    snapshot?.role === "participant" &&
    snapshot.personal_activity_result?.activity_item_id != null &&
    String(snapshot.personal_activity_result.activity_item_id) ===
      String(question.question_id)
      ? snapshot.personal_activity_result
      : null;

  const selectedIndexes = useMemo(() => {
    const response = personalResult?.response;
    return new Set(
      response && "selected_option_indexes" in response
        ? response.selected_option_indexes
        : [],
    );
  }, [personalResult?.response]);
  const personalText =
    personalResult?.response && "entries" in personalResult.response
      ? personalResult.response.entries.join("، ")
      : personalResult?.response && "text" in personalResult.response
        ? personalResult.response.text
        : null;

  const options = question.options ?? [];
  const counts = useMemo(() => {
    const byOption = new Map<string, number>();
    for (const row of result?.optionsResult ?? []) {
      byOption.set(
        String(row.option_id),
        Math.max(0, Number(row.number_of_submits ?? 0)),
      );
    }
    return byOption;
  }, [result?.optionsResult]);

  const wordTerms = result?.wordTerms ?? [];
  const totalResponses = Math.max(0, Number(result?.response_count ?? 0));
  const isWordCloud = question.activity_kind === "text";
  const hasCorrectAnswer = question.has_correct_answer !== false;
  const isPoll =
    !isWordCloud &&
    question.has_correct_answer === false &&
    question.is_scored === false;
  const hasScoring = snapshot?.role === "participant" && snapshot.has_scoring;
  const scoreDelta = Number(personalResult?.score_delta ?? 0);
  const totalScore = Number(participant?.score ?? 0);

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        <div className="flex flex-1 flex-col live-panel rounded-showcase p-4  sm:p-7">
          <div className="text-center">
            <p className="text-sm font-bold text-[color:var(--live-muted)]">
              {isWordCloud
                ? "نتیجه ابر واژه"
                : isPoll
                  ? "نتیجه نظرسنجی"
                  : "نتیجه فعالیت"}
            </p>
            {question.question_title ? (
              <p
                className="mt-2 text-sm font-bold text-[color:var(--live-muted)]"
                dir="auto"
              >
                {question.question_title}
              </p>
            ) : null}
            <h1
              className="mt-2 text-2xl font-black leading-10 sm:text-3xl"
              dir="auto"
            >
              {question.question_text || "نتیجه"}
            </h1>
            {question.image_url ? (
              <LiveMediaImage
                src={question.image_url}
                image={question.image}
                preferred="medium"
                alt=""
                className="mx-auto mt-4 max-h-40 max-w-full rounded-card object-contain"
              />
            ) : null}
            <p className="mt-2 text-sm text-[color:var(--live-muted)]">
              {totalResponses.toLocaleString("fa-IR")} پاسخ ثبت‌شده
            </p>
          </div>

          {personalResult ? (
            <div
              className={
                "mx-auto mt-5 grid w-full max-w-xl gap-3 " +
                (hasScoring ? "grid-cols-2" : "grid-cols-1")
              }
              aria-label="نتیجه شخصی شما"
            >
              <div className="rounded-card border border-[color:var(--live-border)] live-theme-overlay-soft p-3 text-center">
                <p className="text-xs text-[color:var(--live-muted)]">
                  {isWordCloud
                    ? "پاسخ شما"
                    : question.is_scored === false
                      ? "وضعیت پاسخ"
                      : "امتیاز این فعالیت"}
                </p>
                <p className="mt-1 text-xl font-black" dir="auto">
                  {isWordCloud
                    ? personalText || "ثبت شد"
                    : question.is_scored === false
                      ? "ثبت شد"
                      : "+" + scoreDelta.toLocaleString("fa-IR")}
                </p>
              </div>
              {hasScoring ? (
                <div className="rounded-card border border-[color:var(--live-border)] live-theme-overlay-soft p-3 text-center">
                  <p className="text-xs text-[color:var(--live-muted)]">
                    امتیاز کل
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {totalScore.toLocaleString("fa-IR")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p
              className="mx-auto mt-5 rounded-full border border-[color:var(--live-border)] live-theme-overlay-subtle px-4 py-2 text-sm text-[color:var(--live-muted)]"
              role="status"
            >
              {isWordCloud
                ? "برای این ابر واژه پاسخی از شما ثبت نشده است."
                : isPoll
                  ? "برای این نظرسنجی پاسخی از شما ثبت نشده است."
                  : "برای این فعالیت پاسخی از شما ثبت نشده است."}
            </p>
          )}

          {isWordCloud ? (
            <WordCloudView
              terms={wordTerms}
              className="live-cloud mt-6 min-h-52 rounded-feature border border-[color:var(--live-border)] p-3"
              emptyLabel="هنوز عبارتی برای نمایش وجود ندارد."
            />
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {options.map((option, index) => {
                const count = counts.get(String(option.option_id)) ?? 0;
                const correct = hasCorrectAnswer && option.answer === true;
                const selected = selectedIndexes.has(index);
                const percentage =
                  totalResponses > 0
                    ? Math.round((count / totalResponses) * 100)
                    : 0;

                return (
                  <article
                    key={String(option.option_id) + ":" + index}
                    className={
                      "rounded-card border-2 p-4 " +
                      (selected
                        ? "ring-2 ring-[color:var(--live-focus)] ring-offset-2 ring-offset-transparent "
                        : "") +
                      (hasCorrectAnswer
                        ? correct
                          ? "border-success/70 bg-success/15"
                          : "border-[color:var(--live-border)] live-theme-overlay-subtle"
                        : "border-[color:var(--live-border)] live-theme-overlay-subtle")
                    }
                  >
                    <div className="flex items-center gap-3">
                      {option.image_url ? (
                        <LiveMediaImage
                          src={option.image_url}
                          image={option.image}
                          preferred="thumbnail"
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-control object-cover"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 font-bold" dir="auto">
                        {option.option_text}
                      </span>
                      <strong className="shrink-0 text-lg">
                        {count.toLocaleString("fa-IR")}
                      </strong>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full live-theme-contrast-soft">
                      <div
                        className="h-full rounded-full bg-[color:var(--live-fg)]"
                        style={{ width: percentage + "%" }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
                      <div className="flex flex-wrap items-center gap-2">
                        {selected ? (
                          <span className="rounded-full live-theme-overlay-soft px-2 py-1">
                            انتخاب شما
                          </span>
                        ) : null}
                        {correct ? (
                          <span className="text-success">پاسخ صحیح</span>
                        ) : null}
                      </div>
                      <span className="text-[color:var(--live-muted)]">
                        {percentage.toLocaleString("fa-IR")}٪
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p
            className="mt-auto pt-6 text-center text-sm text-[color:var(--live-muted)]"
            role="status"
          >
            نتیجه را دیدید؛ منتظر مرحله بعدی ارائه‌دهنده بمانید.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}

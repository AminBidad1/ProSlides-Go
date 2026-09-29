import { useEffect, useMemo, useRef, useState } from "react";

import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import { WordCloudView } from "../../../../shared/ui/WordCloudView.tsx";
import {
  findSlideIndexById,
  isQuestionSlide,
} from "../../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../../model/questionTimer.ts";
import {
  choiceOptionProjectionTextClass,
  choiceProjectionGridClass,
  questionProjectionTextClass,
} from "../../model/projectionLayout.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { LiveMediaImage } from "../../ui/LiveMediaImage.tsx";
import { ManagerControls } from "./ManagerControls.tsx";
import { ManagerLeaderboardDialog } from "./ManagerLeaderboardDialog.tsx";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { ManagerStageProps } from "./types.ts";

type ManagerQuestionProps = ManagerStageProps & {
  isRemoteReady: boolean;
};

type TimerState = {
  remaining: number;
  anchorStartMs: number;
  totalSeconds: number;
};

export function ManagerPickAnswerQuestion({
  sessionId,
  currentSlide,
  totalSlides,
  quiz,
  isRemoteReady,
}: ManagerQuestionProps) {
  const {
    isStreamConnected,
    sendNavigation,
    sendEnd,
    snapshot,
    loadRoster,
    loadMoreRoster,
    hasMoreRoster,
    isRosterLoading,
  } = useLiveSession();
  const {
    questionResults,
    modalLeaderboardResults,
    currentQuestion: liveCurrentQuestion,
  } = useServerData();
  const [showQr, setShowQr] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const activeItemId = snapshot?.session.active_item_id ?? null;
  const activeSlideIndex = findSlideIndexById(quiz.slides, activeItemId);
  const resolvedSlideNumber =
    activeSlideIndex >= 0 ? activeSlideIndex + 1 : currentSlide;
  const definitionSlide =
    activeSlideIndex >= 0
      ? quiz.slides[activeSlideIndex]
      : quiz.slides[currentSlide - 1];
  const definitionQuestion: LegacyQuestionSlide | null =
    isRemoteReady && isQuestionSlide(definitionSlide)
      ? definitionSlide
      : null;
  const liveMatchesActiveItem =
    activeItemId != null &&
    liveCurrentQuestion?.question_id != null &&
    String(liveCurrentQuestion.question_id) === String(activeItemId);
  const currentQuestion: LegacyQuestionSlide | null =
    liveMatchesActiveItem
      ? liveCurrentQuestion
      : definitionQuestion;

  const liveMatchesDefinition =
    currentQuestion?.question_id != null &&
    liveCurrentQuestion?.question_id != null &&
    String(currentQuestion.question_id) ===
      String(liveCurrentQuestion.question_id);

  const timerRunId = liveMatchesDefinition
    ? liveCurrentQuestion?.run_id ?? currentQuestion?.run_id
    : currentQuestion?.run_id;
  const timerRemainingSeconds = liveMatchesDefinition
    ? liveCurrentQuestion?.remaining_seconds ??
      currentQuestion?.remaining_seconds
    : currentQuestion?.remaining_seconds;
  const timerIdentity =
    currentQuestion?.question_id == null
      ? null
      : `${String(currentQuestion.question_id)}:${String(timerRunId ?? "na")}`;
  const activeTimerIdentityRef = useRef<string | null>(null);

  const [timerState, setTimerState] = useState<TimerState>({
    remaining: 0,
    anchorStartMs: Date.now(),
    totalSeconds: 0,
  });

  useEffect(() => {
    if (!currentQuestion || !timerIdentity) {
      activeTimerIdentityRef.current = null;
      setTimerState({
        remaining: 0,
        anchorStartMs: Date.now(),
        totalSeconds: 0,
      });
      return;
    }

    // Presence/roster updates may project a fresh question object with a stale
    // remaining_seconds value. The timer anchor belongs to the question run,
    // so preserve it until the run identity actually changes.
    if (activeTimerIdentityRef.current === timerIdentity) return;

    const resolved = resolveQuestionTimer({
      question: {
        ...currentQuestion,
        run_id: timerRunId,
        remaining_seconds: timerRemainingSeconds,
      },
      roomId: sessionId,
      role: "manager",
    });
    activeTimerIdentityRef.current = timerIdentity;
    setTimerState({
      remaining: resolved.remainingSeconds,
      anchorStartMs: resolved.anchorStartMs,
      totalSeconds: resolved.totalSeconds,
    });
  }, [
    currentQuestion,
    sessionId,
    timerIdentity,
    timerRemainingSeconds,
    timerRunId,
  ]);

  const resultMatches =
    currentQuestion?.question_id != null &&
    questionResults?.question_id != null &&
    String(currentQuestion.question_id) === String(questionResults.question_id);

  const resultOptions = useMemo(
    () => (resultMatches ? questionResults?.optionsResult ?? [] : []),
    [questionResults, resultMatches],
  );

  const options = useMemo(
    () => currentQuestion?.options ?? [],
    [currentQuestion],
  );
  const optionGridColumns = choiceProjectionGridClass(options.length);
  const questionTextClass = questionProjectionTextClass(
    currentQuestion?.question_text ?? "",
  );
  const hasCorrectAnswer = currentQuestion?.has_correct_answer !== false;
  const votes = useMemo(
    () =>
      options.map((option) => {
        const result = resultOptions.find(
          (candidate) =>
            String(candidate.option_id) === String(option.option_id),
        );
        return Number(result?.number_of_submits ?? 0);
      }),
    [options, resultOptions],
  );

  const showResults = resultMatches && questionResults !== null;
  const totalVotes = votes.reduce((sum, count) => sum + count, 0);
  const isWordCloud = currentQuestion?.activity_kind === "text";
  const wordTerms = useMemo(
    () => (resultMatches ? questionResults?.wordTerms ?? [] : []),
    [questionResults, resultMatches],
  );
  const responseCount = resultMatches
    ? Number(questionResults?.response_count ?? 0)
    : 0;

  useEffect(() => {
    if (!currentQuestion || showResults || timerState.totalSeconds <= 0) return;

    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - timerState.anchorStartMs) / 1000;
      setTimerState((current) => ({
        ...current,
        remaining: Math.max(0, current.totalSeconds - elapsed),
      }));
    }, 250);

    return () => window.clearInterval(interval);
  }, [
    currentQuestion,
    showResults,
    timerState.anchorStartMs,
    timerState.totalSeconds,
  ]);

  const activityPhase = snapshot?.session.activity_phase ?? null;
  const primaryControlLabel =
    activityPhase === "accepting" || activityPhase === "closed"
      ? "نمایش نتیجه"
      : activityPhase === "revealed" &&
          currentQuestion?.show_leaderboard_after
        ? "نمایش رتبه‌بندی"
        : "بعدی";

  const handleNext = async () => {
    if (!currentQuestion) return;

    if (activityPhase === "accepting" || activityPhase === "closed") {
      await sendNavigation("next");
      return;
    }

    const nextSlide = quiz.slides[resolvedSlideNumber];

    if (currentQuestion.show_leaderboard_after) {
      await sendNavigation("next");
      return;
    }

    if (!nextSlide) {
      await sendEnd();
      return;
    }

    if (await sendNavigation("next", { slide: nextSlide })) {
      // The authoritative snapshot will move the controller to the next item.
    }
  };

  const handleEnd = async () => {
    await sendEnd();
  };

  const theme = participantTheme(quiz);
  const awaitingResults =
    currentQuestion !== null &&
    timerState.remaining <= 0 &&
    !showResults;

  return (
    <div
      dir="rtl"
      className="h-screen h-dvh overflow-hidden bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <ManagerTopBar
        accessCode={quiz.access_code}
        isConnected={isStreamConnected}
        qrOpen={showQr}
        onQrToggle={() => setShowQr((value) => !value)}
      />
      <ManagerQrPanel
        accessCode={quiz.access_code}
        isOpen={showQr}
        onClose={() => setShowQr(false)}
      />

      <main
        className={`flex h-full min-h-0 flex-col overflow-hidden px-4 pb-20 pt-16 transition-[padding] sm:px-6 sm:pb-20 sm:pt-[4.5rem] ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        {!currentQuestion ? (
          <div
            className="m-auto rounded-2xl border border-white/10 bg-[color:var(--live-surface)] px-6 py-5 text-center text-lg font-bold"
            role="status"
          >
            در حال آماده‌سازی سؤال…
          </div>
        ) : (
          <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
            <div className="shrink-0 pt-2 text-center">
              <p className="text-sm text-[color:var(--live-muted)]">
                سؤال {resolvedSlideNumber.toLocaleString("fa-IR")} از{" "}
                {totalSlides.toLocaleString("fa-IR")}
              </p>
              {currentQuestion.question_title ? (
                <p
                  className="mx-auto mt-1 line-clamp-1 max-w-4xl text-sm font-bold text-[color:var(--live-muted)]"
                  dir="auto"
                >
                  {currentQuestion.question_title}
                </p>
              ) : null}
              <h1
                className={`mx-auto mt-1 max-w-5xl font-black ${questionTextClass}`}
                dir="auto"
              >
                {currentQuestion.question_text}
              </h1>
            </div>

            {awaitingResults ? (
              <div
                className="mx-auto mt-4 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm"
                role="status"
                aria-live="polite"
              >
                زمان پاسخ‌گویی پایان یافت؛ برای ادامه نتیجه را نمایش دهید.
              </div>
            ) : !showResults && timerState.remaining > 0 ? (
              <div
                className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full border-4 border-white/15 bg-black/20 text-2xl font-black sm:h-20 sm:w-20 sm:text-3xl"
                role="timer"
                aria-label="زمان باقی‌مانده"
              >
                {Math.ceil(timerState.remaining).toLocaleString("fa-IR")}
              </div>
            ) : null}

            {isWordCloud ? (
              <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                {showResults ? (
                  <p className="mb-4 text-center text-sm text-[color:var(--live-muted)]">
                    {responseCount.toLocaleString("fa-IR")} پاسخ ثبت‌شده
                  </p>
                ) : null}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-4 shadow-2xl sm:p-5">
                  {currentQuestion.image_url ? (
                    <LiveMediaImage
                      src={currentQuestion.image_url}
                      alt="تصویر سؤال"
                      className="mx-auto mb-3 max-h-40 max-w-full rounded-2xl object-contain"
                    />
                  ) : null}
                  {!showResults ? (
                    <div
                      className="grid min-h-0 flex-1 place-items-center"
                      aria-label="در انتظار پاسخ‌های ابر واژه"
                    >
                      <p className="max-w-2xl text-center text-lg font-bold leading-8 text-[color:var(--live-muted)]">
                        پاسخ‌ها در حال جمع‌آوری هستند. ابر واژه پس از نمایش نتیجه
                        در همین صفحه ظاهر می‌شود.
                      </p>
                    </div>
                  ) : (
                    <WordCloudView
                      terms={wordTerms}
                      className="min-h-0 flex-1"
                      emptyLabel="هنوز عبارتی برای نمایش وجود ندارد."
                      ariaLabel="نتیجه ابر واژه"
                      displayMode="projection"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 gap-5 overflow-hidden">
                {currentQuestion.image_url ? (
                  <div className="hidden w-1/4 shrink-0 items-center justify-center lg:flex">
                    <LiveMediaImage
                      src={currentQuestion.image_url}
                      alt="تصویر سؤال"
                      className="max-h-[48dvh] max-w-full rounded-2xl object-contain shadow-xl"
                    />
                  </div>
                ) : null}

                <div className={`grid h-full min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-hidden ${optionGridColumns}`}>
                  {options.map((option, index) => {
                    const correct = option.answer === true;
                    const count = votes[index] ?? 0;
                    const height =
                      showResults && totalVotes > 0
                        ? Math.max(6, (count / totalVotes) * 100)
                        : 0;
                    const color = getColorForUser(option.option_id);

                    return (
                      <article
                        key={option.option_id}
                        className="flex min-h-0 min-w-0 flex-col items-center justify-end overflow-hidden"
                      >
                        {showResults ? (
                          <p className="mb-2 text-2xl font-black">
                            {count.toLocaleString("fa-IR")}
                          </p>
                        ) : null}
                        {option.image_url ? (
                          <LiveMediaImage
                            src={option.image_url}
                            alt={option.option_text}
                            className="mb-2 max-h-[10dvh] max-w-full rounded-xl object-contain"
                          />
                        ) : null}
                        <div className="flex min-h-0 w-full flex-1 items-end">
                          <div
                            className={`w-full rounded-t-2xl transition-[height] duration-700 ${
                              showResults && hasCorrectAnswer
                                ? correct
                                  ? "bg-success"
                                  : "bg-danger/80"
                                : "bg-white/10"
                            }`}
                            style={{
                              height: showResults ? `${height}%` : "8%",
                              backgroundColor:
                                showResults && hasCorrectAnswer
                                  ? undefined
                                  : color,
                            }}
                            aria-hidden="true"
                          />
                        </div>
                        <p
                          className={`mt-2 min-h-10 text-center font-bold ${choiceOptionProjectionTextClass(
                            options.length,
                            option.option_text ?? "",
                          )}`}
                          dir="auto"
                        >
                          {option.option_text}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <ManagerControls
        currentSlide={resolvedSlideNumber}
        totalSlides={totalSlides}
        onNext={currentQuestion ? handleNext : undefined}
        onEnd={handleEnd}
        primaryLabel={primaryControlLabel}
        primaryAriaLabel={primaryControlLabel}
        onShowLeaderboard={() => {
          setShowLeaderboard(true);
          void loadRoster("score", false);
        }}
        endOnLastSlide={false}
      />

      <ManagerLeaderboardDialog
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        players={modalLeaderboardResults ?? []}
        hasMore={hasMoreRoster}
        isLoading={isRosterLoading}
        onLoadMore={() => void loadMoreRoster()}
      />
    </div>
  );
}

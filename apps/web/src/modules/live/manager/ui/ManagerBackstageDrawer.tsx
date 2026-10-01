import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  getColorForUser,
  getTextColorForPlayerColor,
} from "../../../../shared/lib/playerColor.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { Input } from "../../../../shared/ui/primitives/Input.tsx";
import { WordCloudView } from "../../../../shared/ui/WordCloudView.tsx";
import type { LivePresentationModel } from "../../model/presentation.ts";
import { useManagerActivityProgress } from "../useManagerActivityProgress.ts";
import {
  isContentSlide,
  isQuestionSlide,
} from "../../model/presentationFlow.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerLeaderboardDialog } from "./ManagerLeaderboardDialog.tsx";

type ManagerBackstageDrawerProps = {
  quiz: LivePresentationModel;
  currentSlide: number;
};

type PrimaryControl =
  | { kind: "start"; label: string }
  | { kind: "close"; label: string }
  | { kind: "reveal"; label: string }
  | { kind: "ranking"; label: string }
  | { kind: "next"; label: string }
  | { kind: "end"; label: string }
  | { kind: "disabled"; label: string };

const itemLabel = (
  slide: LivePresentationModel["slides"][number] | undefined,
): string => {
  if (!slide) return "پایان ارائه";
  if (isQuestionSlide(slide)) {
    return slide.question_text?.trim() || slide.question_title?.trim() || "فعالیت";
  }
  if (isContentSlide(slide)) {
    return slide.title?.trim() || slide.content_text?.trim() || "محتوا";
  }
  return "آیتم";
};

const phaseLabel = (phase: string | null | undefined) => {
  switch (phase) {
    case "accepting":
      return "دریافت پاسخ";
    case "closed":
      return "پاسخ‌گویی بسته";
    case "revealed":
      return "نتیجه آشکار";
    default:
      return "بدون فعالیت فعال";
  }
};

const normalizeModerationSearch = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/gu, " ")
    .trim();

export function ManagerBackstageDrawer({
  quiz,
  currentSlide,
}: ManagerBackstageDrawerProps) {
  const location = useLocation();
  const backstageMode =
    new URLSearchParams(location.search).get("backstage") === "1";
  const [isOpen, setIsOpen] = useState(backstageMode);
  const [showRanking, setShowRanking] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [commandPending, setCommandPending] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [privateSurfaceArmed, setPrivateSurfaceArmed] = useState(false);
  const [moderationPendingKey, setModerationPendingKey] = useState("");
  const [moderationError, setModerationError] = useState("");
  const [moderationQuery, setModerationQuery] = useState("");
  const {
    snapshot,
    isStreamConnected,
    connectionError,
    participantCount,
    sendNavigation,
    sendManagerAction,
    moderateWordCloudTerm,
    sendEnd,
    loadRoster,
    loadMoreRoster,
    hasMoreRoster,
    isRosterLoading,
  } = useLiveSession();
  const {
    modalLeaderboardResults,
    currentQuestion,
    questionResults,
  } = useServerData();

  const managerSnapshot = snapshot?.role === "manager" ? snapshot : null;
  const session = managerSnapshot?.session ?? null;
  const liveResponseCount = useManagerActivityProgress({
    enabled: backstageMode && privateSurfaceArmed,
    sessionId: session?.id,
    activeItemId: session?.active_item_id,
    activityPhase: session?.activity_phase,
    fallbackCount: Number(managerSnapshot?.active_activity_response_count ?? 0),
  });

  const currentIndex = Math.max(0, currentSlide - 1);
  const nextSlide = quiz.slides[currentSlide] ?? null;
  const firstSlide = quiz.slides.find((slide) => slide !== null) ?? null;

  const currentItem = useMemo(
    () => itemLabel(quiz.slides[currentIndex]),
    [currentIndex, quiz.slides],
  );
  const nextItem = useMemo(
    () => itemLabel(quiz.slides[currentSlide]),
    [currentSlide, quiz.slides],
  );

  const resultMatches =
    currentQuestion?.question_id != null &&
    questionResults?.question_id != null &&
    String(currentQuestion.question_id) === String(questionResults.question_id);
  const resultRows = resultMatches ? questionResults?.optionsResult ?? [] : [];
  const wordTerms = resultMatches ? questionResults?.wordTerms ?? [] : [];
  const isWordCloud = currentQuestion?.activity_kind === "text";
  const responseCount = Number(
    session?.activity_phase === "accepting"
      ? liveResponseCount
      : resultMatches
        ? questionResults?.response_count ??
          managerSnapshot?.activity_result?.response_count ??
          0
        : managerSnapshot?.activity_result?.response_count ?? 0,
  );
  const responseDenominator = Math.max(
    responseCount,
    Number(managerSnapshot?.participant_count ?? participantCount ?? 0),
  );
  const responseProgress =
    session?.activity_phase === "accepting" && responseDenominator > 0
      ? Math.round((responseCount / responseDenominator) * 100)
      : null;
  const activityResultVisible =
    session?.activity_phase === "closed" ||
    session?.activity_phase === "revealed";
  const topPerformers = managerSnapshot?.activity_top_performers ?? [];
  const wordCloudModeration =
    isWordCloud &&
    managerSnapshot?.word_cloud_moderation?.activity_item_id ===
      String(currentQuestion?.question_id ?? "")
      ? managerSnapshot.word_cloud_moderation
      : null;
  const moderationTerms = wordCloudModeration?.terms ?? [];
  const normalizedModerationQuery = normalizeModerationSearch(moderationQuery);
  const filteredModerationTerms = normalizedModerationQuery
    ? moderationTerms.filter(
        (term) =>
          normalizeModerationSearch(term.text).includes(
            normalizedModerationQuery,
          ) ||
          normalizeModerationSearch(term.canonical_key).includes(
            normalizedModerationQuery,
          ),
      )
    : moderationTerms;
  const hiddenModerationCount = moderationTerms.filter(
    (term) => term.hidden,
  ).length;

  const stageView =
    session?.stage_view === "overall_ranking"
      ? "رتبه‌بندی کلی"
      : "آیتم جاری";

  const primaryControl = useMemo<PrimaryControl>(() => {
    if (!session || commandPending || moderationPendingKey) {
      return {
        kind: "disabled",
        label: commandPending
          ? "در حال اعمال…"
          : moderationPendingKey
            ? "در حال اعمال مدیریت واژه…"
            : "در انتظار جلسه",
      };
    }
    if (session.state === "ended") {
      return { kind: "disabled", label: "جلسه پایان یافته" };
    }
    if (session.state === "draft" || session.state === "lobby") {
      return firstSlide
        ? { kind: "start", label: "شروع ارائه و باز کردن اولین آیتم" }
        : { kind: "disabled", label: "آیتمی برای اجرا وجود ندارد" };
    }
    if (session.activity_phase === "accepting") {
      return { kind: "close", label: "بستن پاسخ‌گویی" };
    }
    if (session.activity_phase === "closed") {
      return { kind: "reveal", label: "نمایش نتیجه روی Stage" };
    }
    if (
      session.activity_phase === "revealed" &&
      session.stage_view === "item" &&
      currentQuestion?.is_scored !== false &&
      currentQuestion?.show_leaderboard_after === true
    ) {
      return { kind: "ranking", label: "نمایش رتبه‌بندی کلی روی Stage" };
    }
    if (nextSlide) {
      return { kind: "next", label: "باز کردن آیتم بعدی" };
    }
    return { kind: "end", label: "پایان جلسه" };
  }, [
    commandPending,
    moderationPendingKey,
    currentQuestion?.is_scored,
    currentQuestion?.show_leaderboard_after,
    firstSlide,
    nextSlide,
    session,
  ]);

  const setWordCloudTermHidden = async (
    canonicalKey: string,
    hidden: boolean,
  ) => {
    if (moderationPendingKey) return;
    setModerationError("");
    setModerationPendingKey(canonicalKey);
    try {
      const applied = await moderateWordCloudTerm(canonicalKey, hidden);
      if (!applied) {
        setModerationError(
          "تغییر اعمال نشد. وضعیت جلسه تازه‌سازی شد؛ وضعیت واژه را بررسی و دوباره تلاش کنید.",
        );
      }
    } finally {
      setModerationPendingKey("");
    }
  };

  const runPrimaryControl = async () => {
    setCommandError("");
    if (primaryControl.kind === "disabled") return;
    if (primaryControl.kind === "end") {
      setConfirmEnd(true);
      return;
    }

    setCommandPending(true);
    try {
      let applied = false;
      switch (primaryControl.kind) {
        case "start":
          applied = firstSlide
            ? await sendNavigation("start", { slide: firstSlide })
            : false;
          break;
        case "close":
          applied = await sendManagerAction("close_activity");
          break;
        case "reveal":
          applied = await sendManagerAction("reveal_activity");
          break;
        case "ranking":
          applied = await sendManagerAction("show_overall_ranking");
          break;
        case "next":
          applied = nextSlide
            ? await sendNavigation("next", { slide: nextSlide })
            : false;
          break;
      }
      if (!applied) {
        setCommandError(
          "فرمان تأیید نشد. وضعیت جلسه از snapshot معتبر بازیابی می‌شود؛ دوباره تلاش کنید.",
        );
      }
    } finally {
      setCommandPending(false);
    }
  };

  const finishSession = async () => {
    setCommandError("");
    setCommandPending(true);
    try {
      const ended = await sendEnd();
      if (ended) {
        setConfirmEnd(false);
      } else {
        setCommandError("پایان جلسه تأیید نشد. وضعیت اتصال را بررسی کنید.");
      }
    } finally {
      setCommandPending(false);
    }
  };

  const openPrivateRanking = () => {
    setShowRanking(true);
    void loadRoster("score", false);
  };

  const privateBackstageHref =
    `/manager/presentation/${encodeURIComponent(quiz.quiz_id)}?backstage=1`;

  if (backstageMode && !privateSurfaceArmed) {
    return (
      <main
        dir="rtl"
        className="grid min-h-dvh place-items-center bg-stage px-5 py-10 text-content-inverse"
        data-backstage-privacy-gate="true"
      >
        <section className="w-full max-w-xl rounded-feature border border-stage-border bg-stage-soft/50 p-6 shadow-feature sm:p-8">
          <p className="text-xs font-black text-warning">
            سطح خصوصی ارائه‌دهنده
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            پیش از نمایش اطلاعات پشت‌صحنه
          </h1>
          <p className="mt-4 text-sm font-medium leading-7 text-stage-muted">
            این پنجره می‌تواند تعداد پاسخ‌ها، نتیجه بسته‌شده و رتبه‌بندی خصوصی را
            نشان دهد. ابتدا مطمئن شوید این پنجره روی ویدئوپروژکتور، اشتراک صفحه یا
            نمایشگر عمومی دیده نمی‌شود.
          </p>
          <button
            type="button"
            onClick={() => setPrivateSurfaceArmed(true)}
            className="mt-6 min-h-12 w-full rounded-card bg-brand px-4 font-black text-content-inverse hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
          >
            نمایش پشت‌صحنه خصوصی
          </button>
          <p className="mt-3 text-xs leading-6 text-stage-muted">
            اگر فقط یک نمایشگر دارید و همان تصویر برای مخاطبان پخش می‌شود، این
            صفحه را باز نگه ندارید.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      {!backstageMode ? (
        <a
          href={privateBackstageHref}
          target="_blank"
          rel="noreferrer"
          className="fixed end-4 top-20 z-40 grid min-h-11 place-items-center rounded-card border border-stage-border bg-stage/90 px-4 text-sm font-black text-content-inverse shadow-card backdrop-blur hover:bg-stage-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="باز کردن پشت‌صحنه خصوصی در پنجره جدا"
        >
          پشت‌صحنه خصوصی
        </a>
      ) : null}

      <DialogPrimitive.Root
        open={backstageMode || isOpen}
        onOpenChange={(open) => {
          if (!backstageMode) setIsOpen(open);
        }}
      >

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={backstageMode ? "hidden" : "fixed inset-0 z-[60] bg-overlay"}
          />
          <DialogPrimitive.Content
            dir="rtl"
            className={
              backstageMode
                ? "fixed inset-0 z-[61] flex w-full flex-col overflow-y-auto bg-stage p-5 text-content-inverse outline-none sm:p-7"
                : "fixed inset-y-0 end-0 z-[61] flex w-[min(36rem,94vw)] flex-col overflow-y-auto border-0 border-s border-stage-border bg-stage p-5 text-content-inverse shadow-feature outline-none"
            }
            aria-labelledby="backstage-title"
            onEscapeKeyDown={(event) => {
              if (showRanking) {
                event.preventDefault();
                setShowRanking(false);
                return;
              }
              if (backstageMode) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            data-backstage-surface="presenter"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-stage-muted">کنترل خصوصی ارائه‌دهنده</p>
                {backstageMode ? (
                  <div className="mt-2 flex max-w-2xl flex-wrap items-center gap-2 rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold leading-6 text-warning">
                    <span className="min-w-0 flex-1">
                      این صفحه خصوصی است و نباید روی نمایشگر سالن یا اشتراک عمومی نمایش داده شود.
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrivateSurfaceArmed(false)}
                      className="min-h-9 rounded-control border border-warning/30 px-3 text-xs font-black hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/60"
                    >
                      پوشاندن اطلاعات
                    </button>
                  </div>
                ) : null}
                <DialogPrimitive.Title asChild>
                  <h2 id="backstage-title" className="mt-1 text-2xl font-black">
                    پشت‌صحنه
                  </h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  کنترل خصوصی ارائه، وضعیت اتصال، نتایج فعالیت و رتبه‌بندی جلسه.
                </DialogPrimitive.Description>
              </div>
              {!backstageMode ? (
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="grid min-h-11 min-w-11 place-items-center rounded-full bg-stage-soft text-2xl hover:bg-stage-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    aria-label="بستن پشت‌صحنه"
                  >
                    ×
                  </button>
                </DialogPrimitive.Close>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-card bg-stage-soft/50 p-4">
                <p className="text-xs text-stage-muted">شرکت‌کنندگان</p>
                <p className="mt-1 text-2xl font-black">
                  {Number(participantCount || 0).toLocaleString("fa-IR")}
                </p>
              </div>
              <div
                className="rounded-card bg-stage-soft/50 p-4"
                aria-live="polite"
                aria-atomic="true"
                aria-label={
                  session?.activity_phase === "accepting"
                    ? responseCount.toLocaleString("fa-IR") +
                      " پاسخ از " +
                      responseDenominator.toLocaleString("fa-IR") +
                      " شرکت‌کننده"
                    : responseCount.toLocaleString("fa-IR") + " پاسخ ثبت‌شده"
                }
              >
                <p className="text-xs text-stage-muted">پاسخ‌های فعالیت</p>
                <p className="mt-1 text-2xl font-black">
                  {session?.activity_phase === "accepting" &&
                  responseDenominator > 0
                    ? responseCount.toLocaleString("fa-IR") +
                      " / " +
                      responseDenominator.toLocaleString("fa-IR")
                    : responseCount.toLocaleString("fa-IR")}
                </p>
                {responseProgress != null ? (
                  <>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-stage-soft"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-300"
                        style={{ width: responseProgress + "%" }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-stage-muted">
                      {responseProgress.toLocaleString("fa-IR")}٪ پاسخ داده‌اند
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            <section className="mt-4 rounded-card border border-stage-border bg-stage-soft/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">کنترل اجرا</h3>
                <span className="rounded-full bg-stage-soft px-2.5 py-1 text-xs text-stage-muted">
                  {stageView}
                </span>
              </div>

              <div className="mt-4 rounded-card bg-stage/50 p-4">
                <p className="text-xs text-stage-muted">آیتم جاری</p>
                <p className="mt-1 line-clamp-2 font-black" dir="auto">
                  {currentItem}
                </p>
                <div className="mt-3 border-t border-stage-border pt-3">
                  <p className="text-xs text-stage-muted">آیتم بعدی</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-content-inverse/80" dir="auto">
                    {nextItem}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={() => void runPrimaryControl()}
                disabled={primaryControl.kind === "disabled" || commandPending}
                className="mt-4 w-full"
              >
                {primaryControl.label}
              </Button>
              <p className="mt-2 text-xs leading-6 text-stage-muted">
                هر فرمان با state version فعلی ارسال می‌شود؛ وضعیت Stage فقط پس از تأیید سرور تغییر می‌کند.
              </p>
              {commandError ? (
                <p className="mt-3 rounded-control bg-danger/15 p-3 text-xs leading-6 text-danger" role="alert">
                  {commandError}
                </p>
              ) : null}
            </section>

            <section className="mt-4 rounded-card border border-stage-border bg-stage-soft/50 p-4">
              <h3 className="text-sm font-black">وضعیت زنده و بازیابی</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stage-muted">اتصال</dt>
                  <dd className={isStreamConnected ? "text-success" : "text-warning"}>
                    {isStreamConnected ? "متصل" : "در حال بازیابی"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stage-muted">فعالیت</dt>
                  <dd>{phaseLabel(session?.activity_phase)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stage-muted">نسخه وضعیت</dt>
                  <dd dir="ltr">{session?.state_version ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stage-muted">آخرین رویداد</dt>
                  <dd dir="ltr">{managerSnapshot?.last_event_id ?? "—"}</dd>
                </div>
              </dl>
              {!isStreamConnected && connectionError ? (
                <p className="mt-3 rounded-control bg-warning/15 p-3 text-xs leading-6 text-warning" role="status">
                  ارتباط زنده در حال بازیابی است. snapshot معتبر قبل از ادامه event stream دوباره خوانده می‌شود.
                </p>
              ) : null}
            </section>

            {activityResultVisible && currentQuestion ? (
              <section className="mt-4 rounded-card border border-stage-border bg-stage-soft/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black">نتیجه خصوصی فعالیت</h3>
                  <span className="text-xs text-stage-muted">
                    {responseCount.toLocaleString("fa-IR")} پاسخ
                  </span>
                </div>
                {isWordCloud ? (
                  <>
                    <WordCloudView
                      terms={wordTerms}
                      className="mt-3 min-h-44 rounded-card bg-stage/50 p-3"
                      emptyLabel="هنوز عبارتی برای نمایش وجود ندارد."
                      ariaLabel="پیش‌نمایش خصوصی ابر واژه"
                    />
                    {backstageMode && wordCloudModeration ? (
                      <div className="mt-4 rounded-card border border-stage-border bg-stage/50 p-3 sm:p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-black">
                              مدیریت واژه‌های ابر
                            </h4>
                            <p className="mt-1 max-w-xl text-xs leading-6 text-stage-muted">
                              پنهان‌کردن فقط نمایش aggregate را تغییر می‌دهد؛
                              پاسخ خام شرکت‌کننده برای گزارش و audit حذف نمی‌شود.
                            </p>
                          </div>
                          <span className="rounded-full bg-stage-soft px-3 py-1 text-xs font-bold text-stage-muted">
                            {hiddenModerationCount.toLocaleString("fa-IR")} پنهان
                          </span>
                        </div>

                        {session?.activity_phase === "revealed" ? (
                          <p className="mt-3 rounded-control border border-warning/25 bg-warning/10 px-3 py-2 text-xs font-bold leading-6 text-warning">
                            نتیجه اکنون نمایش داده شده است؛ هر تغییر پس از همگام‌سازی
                            فوراً روی Stage و نتیجه شرکت‌کنندگان اعمال می‌شود.
                          </p>
                        ) : (
                          <p className="mt-3 rounded-control bg-stage-soft/50 px-3 py-2 text-xs leading-6 text-stage-muted">
                            نتیجه هنوز عمومی نشده است. می‌توانید واژه‌ها را پیش از
                            نمایش نتیجه بازبینی کنید.
                          </p>
                        )}

                        <label className="mt-3 block">
                          <span className="sr-only">جست‌وجوی واژه برای مدیریت</span>
                          <Input
                            type="search"
                            tone="dark"
                            value={moderationQuery}
                            onChange={(event) =>
                              setModerationQuery(event.target.value)
                            }
                            placeholder="جست‌وجوی واژه…"
                            className="min-h-11 font-medium"
                          />
                        </label>

                        {moderationError ? (
                          <p
                            className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-xs font-bold leading-6 text-danger"
                            role="alert"
                          >
                            {moderationError}
                          </p>
                        ) : null}

                        <div
                          className="mt-3 max-h-80 space-y-2 overflow-y-auto pe-1"
                          aria-label="فهرست مدیریت واژه‌های ابر"
                        >
                          {filteredModerationTerms.length > 0 ? (
                            filteredModerationTerms.map((term) => {
                              const pending =
                                moderationPendingKey === term.canonical_key;
                              return (
                                <div
                                  key={term.canonical_key}
                                  className={
                                    "flex min-h-12 items-center gap-3 rounded-control border px-3 py-2 " +
                                    (term.hidden
                                      ? "border-warning/20 bg-warning/5"
                                      : "border-stage-border bg-stage-soft/50")
                                  }
                                >
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={
                                        "truncate text-sm font-black " +
                                        (term.hidden
                                          ? "text-stage-muted line-through"
                                          : "text-content-inverse")
                                      }
                                      dir="auto"
                                      title={term.text}
                                    >
                                      {term.text}
                                    </p>
                                    <p className="mt-0.5 text-xs text-stage-muted">
                                      {term.count.toLocaleString("fa-IR")} بار
                                      {term.hidden ? " · پنهان" : " · قابل نمایش"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void setWordCloudTermHidden(
                                        term.canonical_key,
                                        !term.hidden,
                                      )
                                    }
                                    disabled={
                                      Boolean(moderationPendingKey) ||
                                      commandPending
                                    }
                                    className={
                                      "min-h-9 shrink-0 rounded-control border px-3 text-xs font-black focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-45 " +
                                      (term.hidden
                                        ? "border-success/30 bg-success/10 text-success hover:bg-success/15 focus-visible:ring-success/50"
                                        : "border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 focus-visible:ring-danger/50")
                                    }
                                    aria-label={
                                      (term.hidden
                                        ? "بازگرداندن "
                                        : "پنهان کردن ") + term.text
                                    }
                                  >
                                    {pending
                                      ? "در حال اعمال…"
                                      : term.hidden
                                        ? "بازگرداندن"
                                        : "پنهان کردن"}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="rounded-control bg-stage-soft/50 p-3 text-center text-xs text-stage-muted">
                              {moderationQuery.trim()
                                ? "واژه‌ای با این جست‌وجو پیدا نشد."
                                : "واژه‌ای برای مدیریت وجود ندارد."}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(currentQuestion.options ?? []).map((option, index) => {
                      const count = Number(
                        resultRows.find(
                          (row) => Number(row.option_id) === index,
                        )?.number_of_submits ?? 0,
                      );
                      const correct =
                        currentQuestion.has_correct_answer !== false &&
                        option.answer === true;
                      return (
                        <div
                          key={String(option.option_id ?? index)}
                          className="flex min-h-11 items-center gap-3 rounded-control bg-stage/50 px-3 py-2"
                        >
                          <span
                            className={
                              "h-2.5 w-2.5 shrink-0 rounded-full " +
                              (correct ? "bg-success" : "bg-stage-muted/40")
                            }
                            aria-hidden="true"
                          />
                          <span
                            className="min-w-0 flex-1 truncate text-sm font-bold"
                            dir="auto"
                          >
                            {option.option_text}
                          </span>
                          {correct ? (
                            <span className="text-xs font-bold text-success">
                              صحیح
                            </span>
                          ) : null}
                          <strong className="text-sm">
                            {count.toLocaleString("fa-IR")}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {activityResultVisible && currentQuestion?.is_scored !== false ? (
              <section className="mt-4 rounded-card border border-stage-border bg-stage-soft/50 p-4">
                <h3 className="text-sm font-black">برترین‌های این فعالیت</h3>
                <p className="mt-1 text-xs leading-6 text-stage-muted">
                  این رتبه فقط عملکرد همین فعالیت را نشان می‌دهد و با رتبه‌بندی کلی جلسه متفاوت است.
                </p>
                {topPerformers.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {topPerformers.map((performer) => (
                      <li
                        key={performer.participant_id}
                        className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-control bg-stage/50 px-3 py-2"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full text-xs font-black"
                          style={{
                            backgroundColor: getColorForUser(performer.participant_id),
                            color: getTextColorForPlayerColor(
                              getColorForUser(performer.participant_id),
                            ),
                          }}
                        >
                          {performer.rank.toLocaleString("fa-IR")}
                        </span>
                        <span className="min-w-0 truncate text-sm font-bold" dir="auto">
                          {performer.avatar ? `${performer.avatar} ` : ""}
                          {performer.display_name}
                        </span>
                        <strong className="text-xs">
                          +{Math.round(performer.score_delta).toLocaleString("fa-IR")}
                        </strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 rounded-control bg-stage/50 p-3 text-center text-xs text-stage-muted">
                    هنوز عملکرد امتیازی ثبت نشده است.
                  </p>
                )}
              </section>
            ) : null}

            {session?.id ? (
              <a
                href={`/manager/stage/${session.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 grid min-h-12 place-items-center rounded-card border border-stage-border bg-stage-soft px-4 text-center font-black text-content-inverse hover:bg-stage-border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
              >
                باز کردن Stage در پنجره جدید
              </a>
            ) : null}

            <Button
              type="button"
              variant="inverse"
              size="lg"
              onClick={openPrivateRanking}
              disabled={managerSnapshot?.has_scoring !== true}
              className="mt-3"
            >
              مشاهده خصوصی رتبه‌بندی کلی
            </Button>
            <p className="mt-2 text-xs leading-6 text-stage-muted">
              رتبه‌بندی خصوصی Stage را تغییر نمی‌دهد و از roster محدود manager خوانده می‌شود.
            </p>

            {session?.state !== "ended" && primaryControl.kind !== "end" ? (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                disabled={commandPending || Boolean(moderationPendingKey)}
                className="mt-5 min-h-11 rounded-control border border-danger/40 bg-danger/10 px-4 text-sm font-bold text-danger hover:bg-danger/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
              >
                پایان جلسه
              </button>
            ) : null}

            <ManagerLeaderboardDialog
              isOpen={showRanking}
              onClose={() => setShowRanking(false)}
              players={modalLeaderboardResults ?? []}
              hasMore={hasMoreRoster}
              isLoading={isRosterLoading}
              onLoadMore={() => void loadMoreRoster()}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={finishSession}
        title="پایان جلسه؟"
        description="جلسه برای شرکت‌کنندگان پایان می‌یابد و Stage به نتیجه نهایی می‌رود."
        confirmText="پایان جلسه"
        cancelText="ادامه ارائه"
        confirmVariant="destructive"
        isLoading={commandPending}
      />
    </>
  );
}

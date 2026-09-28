import { useMemo, useState } from "react";

import Notice from "../../../../shared/ui/Notice.tsx";
import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import { LiveLobbyCrowd } from "../../ui/LiveLobbyCrowd.tsx";
import {
  findLiveActivityStartIssue,
  type LiveActivityStartIssue,
} from "../../model/presentationFlow.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { LivePresentationModel } from "../../model/presentation.ts";

type ManagerJoinPageProps = {
  roomId?: string;
  onNext: () => void;
  quiz: LivePresentationModel;
};

export function ManagerJoinPage({
  onNext,
  quiz,
}: ManagerJoinPageProps) {
  const {
    isConnected,
    isStreamConnected,
    connectionError,
    sendNavigation,
    participantCount,
    snapshot,
  } = useLiveSession();
  const { users, currentQuestion, currentContent, leaderboardResults } =
    useServerData();
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQr, setShowQr] = useState(false);
  const [startError, setStartError] = useState("");
  const [startPending, setStartPending] = useState(false);

  const sessionInProgress =
    snapshot?.session.state === "presenting" ||
    currentQuestion !== null ||
    currentContent !== null ||
    (leaderboardResults?.length ?? 0) > 0;

  const startIssue = useMemo(
    () => findLiveActivityStartIssue(quiz.slides),
    [quiz.slides],
  );

  const lobbyParticipants = useMemo(() => {
    if (
      snapshot?.role === "manager" &&
      (snapshot.lobby_participants?.length ?? 0) > 0
    ) {
      return snapshot.lobby_participants!.map((participant) => ({
        id: participant.participant_id,
        name: participant.display_name,
        avatar: participant.avatar,
        color: getColorForUser(participant.participant_id),
      }));
    }

    return users
      .slice(-36)
      .reverse()
      .map((user) => ({
        id: user.user_id,
        name: user.name,
        avatar: user.character,
        color: getColorForUser(user.user_id),
      }));
  }, [snapshot, users]);

  const startIssueMessage = (issue: LiveActivityStartIssue): string => {
    switch (issue) {
      case "text_prompt_required":
        return "پیش از اجرا، متن پرسش ابر واژه را وارد کنید.";
      case "choice_prompt_required":
        return "پیش از اجرا، متن فعالیت انتخابی را وارد کنید.";
      case "choice_options_too_few":
        return "پیش از اجرا، هر فعالیت انتخابی باید حداقل دو گزینه داشته باشد.";
      case "choice_correct_answer_invalid":
        return "پیش از اجرا، پاسخ صحیح فعالیت ارزیابی‌شونده را مشخص کنید.";
    }
  };

  const toggleName = (userId: string) => {
    setHiddenUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleStart = async () => {
    if (startPending) return;
    setStartError("");

    const firstSlide = quiz.slides.find((slide) => slide !== null);
    if (!firstSlide) {
      setStartError("این ارائه اسلایدی برای شروع ندارد.");
      return;
    }
    if (startIssue) {
      setStartError(startIssueMessage(startIssue));
      return;
    }
    if (sessionInProgress) {
      onNext();
      return;
    }
    if (!isConnected) {
      setStartError("اتصال جلسه هنوز آماده نیست. دوباره تلاش کنید.");
      return;
    }

    setStartPending(true);
    try {
      const started = await sendNavigation("start", {
        slide: firstSlide,
      });
      if (!started) {
        setStartError("شروع جلسه تأیید نشد. وضعیت اتصال را بررسی کنید.");
        return;
      }
      onNext();
    } finally {
      setStartPending(false);
    }
  };

  const theme = participantTheme(quiz);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-cover bg-center text-[color:var(--live-fg)]"
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
        className={`mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-24 transition-[padding] sm:px-6 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <section className="my-auto rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              {Number(participantCount).toLocaleString("fa-IR")} بازیکن آماده
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              اتاق انتظار ارائه
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--live-muted)] sm:text-base">
              شرکت‌کنندگان از لینک یا QR وارد می‌شوند و هر ورود تازه به‌صورت
              زنده روی لابی ظاهر می‌شود.
            </p>
          </div>

          <div className="mt-7">
            <LiveLobbyCrowd
              participants={lobbyParticipants}
              total={Number(participantCount || 0)}
              hiddenIds={hiddenUserIds}
              onToggleHidden={toggleName}
              className="min-h-[30rem] sm:min-h-[38rem]"
              emptyTitle="در انتظار ورود شرکت‌کنندگان…"
              emptyDescription="هر شرکت‌کننده با ورود به جلسه، به‌صورت زنده روی این فضا ظاهر می‌شود."
            />
            {lobbyParticipants.length > 0 ? (
              <p className="mt-3 text-center text-xs leading-6 text-[color:var(--live-muted)]">
                برای پنهان‌کردن یک نام از نمای ارائه‌دهنده، روی همان نام بزنید.
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!isConnected || startPending}
              aria-busy={startPending}
              className="min-h-14 min-w-44 rounded-2xl bg-brand px-7 text-lg font-black text-content-inverse shadow-xl hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {startPending
                ? "در حال شروع…"
                : sessionInProgress
                  ? "ادامه جلسه"
                  : "شروع ارائه"}
            </button>
            {startError ? <Notice tone="error">{startError}</Notice> : null}
            {!isStreamConnected && connectionError ? (
              <Notice tone="warning">
                به‌روزرسانی زنده در حال بازیابی است؛ فرمان‌های جلسه همچنان از مسیر امن HTTP ثبت می‌شوند.
              </Notice>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

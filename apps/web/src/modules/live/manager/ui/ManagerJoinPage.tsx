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
  quiz: LivePresentationModel;
};

export function ManagerJoinPage({
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
  const { users } = useServerData();
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQr, setShowQr] = useState(false);
  const [startError, setStartError] = useState("");
  const [startPending, setStartPending] = useState(false);

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
      case "text_prompt_invalid":
        return "پرسش ابر واژه برای نمایش زنده بیش از حد متراکم است؛ آن را در ویرایشگر کوتاه‌تر کنید.";
      case "text_response_invalid":
        return "محدودیت پاسخ ابر واژه با قرارداد اجرای زنده سازگار نیست؛ آن را در ویرایشگر اصلاح کنید.";
      case "activity_timing_invalid":
        return "زمان پاسخ‌گویی باید بین ۵ ثانیه تا ۲۰ دقیقه باشد.";
      case "activity_media_invalid":
        return "یکی از تصاویر فعالیت آدرس معتبر http یا https ندارد.";
      case "content_required":
        return "یکی از اسلایدهای محتوا خالی است؛ پیش از اجرا عنوان، متن یا تصویر اضافه کنید.";
      case "content_density_invalid":
        return "یکی از اسلایدهای محتوا برای نمایش زنده بیش از حد متراکم است؛ متن آن را در ویرایشگر اصلاح کنید.";
      case "content_media_invalid":
        return "یکی از اسلایدهای محتوا آدرس تصویر معتبر http یا https ندارد.";
      case "choice_prompt_required":
        return "پیش از اجرا، متن فعالیت انتخابی را وارد کنید.";
      case "choice_prompt_invalid":
        return "متن یا عنوان سؤال برای نمایش زنده بیش از حد متراکم است؛ آن را در ویرایشگر کوتاه‌تر کنید.";
      case "choice_options_too_few":
        return "پیش از اجرا، هر فعالیت انتخابی باید حداقل دو گزینه داشته باشد.";
      case "choice_options_too_many":
        return "برای اجرای زنده، سؤال‌های ارزیابی‌شونده حداکثر ۸ گزینه و نظرسنجی‌ها حداکثر ۱۲ گزینه می‌توانند داشته باشند.";
      case "choice_option_invalid":
        return "یکی از گزینه‌ها متن، شناسه یا تصویر نامعتبر برای اجرای زنده دارد؛ آن را در ویرایشگر اصلاح کنید.";
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
    } finally {
      setStartPending(false);
    }
  };

  const theme = participantTheme(quiz);

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
        className={`mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden px-4 pb-4 pt-[4.5rem] transition-[padding] sm:px-6 sm:pb-5 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-md sm:p-6">
          <div className="text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              {Number(participantCount).toLocaleString("fa-IR")} بازیکن آماده
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl xl:text-5xl">
              اتاق انتظار ارائه
            </h1>
            <p className="mx-auto mt-2 max-w-2xl line-clamp-2 text-xs leading-5 text-[color:var(--live-muted)] sm:text-sm sm:leading-6">
              شرکت‌کنندگان از لینک یا QR وارد می‌شوند و هر ورود تازه به‌صورت
              زنده روی لابی ظاهر می‌شود.
            </p>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <LiveLobbyCrowd
              participants={lobbyParticipants}
              total={Number(participantCount || 0)}
              hiddenIds={hiddenUserIds}
              onToggleHidden={toggleName}
              fillAvailable
              emptyTitle="در انتظار ورود شرکت‌کنندگان…"
              emptyDescription="هر شرکت‌کننده با ورود به جلسه، به‌صورت زنده روی این فضا ظاهر می‌شود."
            />
            {lobbyParticipants.length > 0 ? (
              <p className="mt-2 shrink-0 text-center text-xs leading-5 text-[color:var(--live-muted)]">
                برای پنهان‌کردن یک نام از نمای ارائه‌دهنده، روی همان نام بزنید.
              </p>
            ) : null}
          </div>

          <div className="mt-4 shrink-0 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!isConnected || startPending}
              aria-busy={startPending}
              className="min-h-14 min-w-44 rounded-2xl bg-brand px-7 text-lg font-black text-content-inverse shadow-xl hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {startPending ? "در حال شروع…" : "شروع ارائه"}
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

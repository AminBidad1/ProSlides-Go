import { useEffect, useMemo, useRef } from "react";
import { motion as Motion } from "framer-motion";

import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyLiveUser } from "../../model/serverData.ts";
import { managerTheme } from "../theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";

type ManagerFinalLeaderboardProps = {
  leaderboardData: LegacyLiveUser[];
  quiz: LivePresentationModel;
  onExit: () => void;
};

const POSITION_ORDER = [
  "md:order-2",
  "md:order-1",
  "md:order-3",
] as const;

const podiumStyleForRank = (rank: number) => {
  if (rank === 1) {
    return {
      height: "h-56 md:h-72",
      gradient: "from-amber-300 to-yellow-500",
      icon: "👑",
    };
  }
  if (rank === 2) {
    return {
      height: "h-44 md:h-56",
      gradient: "from-slate-200 to-slate-400",
      icon: "🥈",
    };
  }
  return {
    height: "h-36 md:h-44",
    gradient: "from-orange-300 to-amber-600",
    icon: "🥉",
  };
};

export function ManagerFinalLeaderboard({
  leaderboardData,
  quiz,
  onExit,
}: ManagerFinalLeaderboardProps) {
  const {
    isStreamConnected,
    snapshot,
    participantCount,
    loadRoster,
  } = useLiveSession();
  const requestedFinalRoster = useRef(false);
  const hasScoring =
    snapshot?.role === "manager" ? snapshot.has_scoring : false;

  useEffect(() => {
    if (
      !hasScoring ||
      leaderboardData.length > 0 ||
      requestedFinalRoster.current
    ) {
      return;
    }
    requestedFinalRoster.current = true;
    void loadRoster("score", false);
  }, [hasScoring, leaderboardData.length, loadRoster]);

  const players = useMemo(() => {
    const sorted = [...leaderboardData].sort(
      (left, right) =>
        Number(right.total_points || 0) - Number(left.total_points || 0),
    );
    let previousScore: number | null = null;
    let previousRank = 0;

    return sorted.slice(0, 3).map((player, index) => {
      const score = Number(player.total_points || 0);
      const derivedRank =
        previousScore !== null && score === previousScore
          ? previousRank
          : index + 1;
      const rank =
        player.rank != null && Number.isFinite(Number(player.rank))
          ? Number(player.rank)
          : derivedRank;
      previousScore = score;
      previousRank = rank;
      return { player, rank };
    });
  }, [leaderboardData]);
  const isSolo = Number(participantCount || 0) === 1;
  const theme = managerTheme(quiz);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex h-screen h-dvh flex-col overflow-hidden bg-cover bg-center px-4 py-4 text-[color:var(--live-fg)] sm:py-5"
      style={theme.style}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <p className="font-brand text-xl font-black" dir="ltr">
          ProSlides
        </p>
        <div
          className="flex items-center gap-2 rounded-full border border-[color:var(--live-control-border)] live-theme-contrast-soft px-3 py-1.5 text-xs backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isStreamConnected ? "bg-success" : "bg-warning"
            }`}
            aria-hidden="true"
          />
          {isStreamConnected ? "متصل" : "در حال اتصال"}
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-center overflow-hidden py-3 text-center sm:py-4">
        <Motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-bold text-[color:var(--live-muted)]"
        >
          پایان کوئیز
        </Motion.p>
        <Motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-3xl font-black md:text-5xl xl:text-6xl"
        >
          {isSolo ? "نتیجه انفرادی" : "برترین‌های این رقابت"}
        </Motion.h1>

        {!hasScoring ? (
          <div className="mt-5 max-w-xl rounded-feature border border-[color:var(--live-control-border)] live-theme-contrast-soft px-8 py-10 text-[color:var(--live-muted)] backdrop-blur">
            <h2 className="text-2xl font-black text-[color:var(--live-fg)]">جلسه پایان یافت</h2>
            <p className="mt-3 leading-7">
              این جلسه فعالیت امتیازی نداشت؛ بنابراین رتبه‌بندی نهایی یا سکو نمایش داده نمی‌شود.
            </p>
          </div>
        ) : isSolo && players.length > 0 ? (
          <div className="mt-5 w-full max-w-xl rounded-showcase border border-[color:var(--live-control-border)] live-theme-contrast-soft px-8 py-10 backdrop-blur">
            <p className="text-sm text-[color:var(--live-muted)]">نتیجه انفرادی</p>
            <h2 className="mt-2 truncate text-3xl font-black" dir="auto">
              {players[0].player.name}
            </h2>
            <p className="mt-5 text-5xl font-black">
              {Math.round(players[0].player.total_points || 0).toLocaleString("fa-IR")}
            </p>
            <p className="mt-2 text-sm text-[color:var(--live-muted)]">
              امتیاز نهایی؛ رتبه رقابتی برای جلسه تک‌نفره نمایش داده نمی‌شود.
            </p>
          </div>
        ) : players.length > 0 ? (
          <div className="mt-5 flex w-full flex-col items-stretch justify-center gap-4 md:flex-row md:items-end">
            {players.map(({ player, rank }, index) => {
              const style = podiumStyleForRank(rank);
              const order = POSITION_ORDER[index];

              return (
                <Motion.article
                  key={player.user_id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index + 1) * 0.18 }}
                  className={`flex flex-1 flex-col items-center ${order}`}
                >
                  <div className="relative z-10 -mb-6 grid h-24 w-24 place-items-center rounded-full border-4 border-content-inverse/70 bg-stage text-5xl shadow-feature">
                    <span className="absolute -top-7 text-4xl" aria-hidden="true">
                      {style.icon}
                    </span>
                    <span aria-hidden="true">{player.character || "👤"}</span>
                  </div>
                  <div
                    className={`flex w-full max-w-xs flex-col justify-between rounded-t-3xl bg-gradient-to-b ${style.gradient} ${style.height} px-4 pb-5 pt-10 text-content shadow-feature`}
                  >
                    <div>
                      <h2 className="truncate text-xl font-black" dir="auto">
                        {player.name}
                      </h2>
                      <p className="mt-1 font-bold">
                        {Math.round(player.total_points || 0).toLocaleString("fa-IR")} امتیاز
                      </p>
                    </div>
                    <p
                      className="text-5xl font-black opacity-30"
                      aria-label={`رتبه ${rank.toLocaleString("fa-IR")}`}
                    >
                      {rank.toLocaleString("fa-IR")}
                    </p>
                  </div>
                </Motion.article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-feature border border-[color:var(--live-control-border)] live-theme-contrast-soft px-8 py-10 text-[color:var(--live-muted)] backdrop-blur">
            هنوز امتیازی برای نمایش وجود ندارد.
          </div>
        )}

        <button
          type="button"
          onClick={onExit}
          className="live-primary-action live-theme-focusable mt-5 min-h-11 shrink-0 rounded-card px-7 font-black"
        >
          بازگشت به پنل مدیریت
        </button>
      </main>
    </div>
  );
}

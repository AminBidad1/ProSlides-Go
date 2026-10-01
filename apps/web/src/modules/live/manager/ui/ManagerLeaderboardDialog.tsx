import { useMemo } from "react";

import type { LegacyLiveUser } from "../../model/serverData.ts";
import {
  getColorForUser,
  getTextColorForPlayerColor,
} from "../../../../shared/lib/playerColor.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { useNativeDialogLifecycle } from "../../../../shared/ui/useNativeDialogLifecycle.ts";

type ManagerLeaderboardDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  players: LegacyLiveUser[];
  hasMore?: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
};

export function ManagerLeaderboardDialog({
  isOpen,
  onClose,
  players,
  hasMore = false,
  isLoading = false,
  onLoadMore,
}: ManagerLeaderboardDialogProps) {
  const {
    dialogRef,
    handleCancel,
    handleClose,
  } = useNativeDialogLifecycle({
    open: isOpen,
    onRequestClose: onClose,
  });
  const maxScore = useMemo(
    () =>
      players.length > 0
        ? Math.max(...players.map((player) => player.total_points || 0), 0)
        : 0,
    [players],
  );

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto max-h-[80dvh] w-[min(54rem,calc(100vw-2rem))] overflow-y-auto rounded-feature border border-stage-border bg-stage p-0 text-content-inverse shadow-feature backdrop:bg-overlay"
      aria-labelledby="manager-leaderboard-dialog-title"
    >
      {isOpen ? (
        <>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-stage-border bg-stage/95 px-5 py-4 backdrop-blur">
            <div>
              <h2
                id="manager-leaderboard-dialog-title"
                className="text-2xl font-black"
              >
                جدول امتیازات
              </h2>
              <p className="mt-1 text-sm text-stage-muted">
                {players.length.toLocaleString("fa-IR")} شرکت‌کننده
              </p>
            </div>
            <Button
              type="button"
              variant="inverseGhost"
              size="icon"
              autoFocus
              onClick={onClose}
              className="rounded-full text-2xl"
              aria-label="بستن جدول امتیازات"
            >
              ×
            </Button>
          </div>

          <ol className="space-y-3 p-5">
            {players.length === 0 ? (
              <li className="rounded-card border border-stage-border bg-stage-soft/50 p-6 text-center text-stage-muted">
                هنوز امتیازی برای نمایش وجود ندارد.
              </li>
            ) : (
              players.map((player, index) => {
                const score = Math.max(0, Number(player.total_points || 0));
                const color = getColorForUser(player.user_id);
                const width =
                  maxScore > 0 ? Math.max(10, (score / maxScore) * 100) : 0;

                return (
                  <li
                    key={player.user_id}
                    className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full font-black"
                      style={{
                        backgroundColor: color,
                        color: getTextColorForPlayerColor(color),
                      }}
                    >
                      {(player.rank ?? index + 1).toLocaleString("fa-IR")}
                    </span>
                    <div className="relative min-h-14 overflow-hidden rounded-card bg-stage-soft">
                      {width > 0 ? (
                        <div
                          className="absolute inset-y-0 start-0 rounded-card opacity-80"
                          style={{ width: `${width}%`, backgroundColor: color }}
                        />
                      ) : null}
                      <div className="relative z-10 flex min-h-14 items-center gap-3 px-4">
                        <span className="text-2xl" aria-hidden="true">
                          {player.character || "🙂"}
                        </span>
                        <span className="truncate font-bold" dir="auto">
                          {player.name}
                        </span>
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-sm font-black">
                      {Math.round(score).toLocaleString("fa-IR")} امتیاز
                    </span>
                  </li>
                );
              })
            )}
          </ol>

          {hasMore && onLoadMore ? (
            <div className="sticky bottom-0 flex justify-center border-t border-stage-border bg-stage/95 p-4 backdrop-blur">
              <Button
                type="button"
                variant="inverseOutline"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? "در حال بارگذاری…" : "نمایش رتبه‌های بیشتر"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

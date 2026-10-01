import { useState } from "react";

import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";

type ManagerControlsProps = {
  currentSlide: number;
  totalSlides: number;
  onNext?: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
  onShowLeaderboard?: () => void;
  primaryLabel?: string;
  primaryAriaLabel?: string;
  endOnLastSlide?: boolean;
};

export function ManagerControls({
  currentSlide,
  totalSlides,
  onNext,
  onEnd,
  onShowLeaderboard,
  primaryLabel,
  primaryAriaLabel,
  endOnLastSlide = true,
}: ManagerControlsProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [primaryPending, setPrimaryPending] = useState(false);

  const safeTotal = Math.max(totalSlides, 1);
  const safeCurrent = Math.min(Math.max(currentSlide, 1), safeTotal);
  const atEnd = endOnLastSlide && safeCurrent >= safeTotal;
  const progress = (safeCurrent / safeTotal) * 100;

  const handlePrimary = async () => {
    if (ending || primaryPending) return;
    if (atEnd) {
      setConfirmEnd(true);
      return;
    }
    if (!onNext) return;

    setPrimaryPending(true);
    try {
      await onNext();
    } finally {
      setPrimaryPending(false);
    }
  };

  const confirmPresentationEnd = async () => {
    setEnding(true);
    try {
      await onEnd();
      setConfirmEnd(false);
    } finally {
      setEnding(false);
    }
  };

  return (
    <>
      <footer
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center justify-between gap-3 border-t border-[color:var(--live-border)] live-theme-contrast-soft px-3 py-2 text-[color:var(--live-fg)] backdrop-blur-md sm:px-5"
        aria-label="کنترل ارائه"
        aria-busy={ending || primaryPending}
      >
        <div className="min-w-28">
          <p className="text-xs text-[color:var(--live-muted)]">آیتم</p>
          <p className="font-bold" dir="ltr">
            {safeCurrent.toLocaleString("fa-IR")} / {safeTotal.toLocaleString("fa-IR")}
          </p>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full live-theme-overlay-medium">
            <div
              className="h-full rounded-full bg-success transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onShowLeaderboard ? (
            <button
              type="button"
              onClick={onShowLeaderboard}
              disabled={ending || primaryPending}
              className="live-secondary-action live-theme-focusable min-h-11 rounded-card px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              جدول امتیازات
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            disabled={ending || primaryPending}
            className="min-h-11 rounded-card bg-danger/85 px-3 text-sm font-bold text-content-inverse hover:bg-danger disabled:cursor-not-allowed disabled:opacity-50 live-theme-focusable"
          >
            پایان ارائه
          </button>
          <button
            type="button"
            onClick={() => void handlePrimary()}
            aria-label={
              atEnd
                ? "پایان از کنترل آیتم"
                : primaryAriaLabel || primaryLabel || "آیتم بعدی"
            }
            disabled={ending || primaryPending || (!atEnd && !onNext)}
            className="min-h-11 rounded-card bg-brand px-5 text-sm font-black text-content-inverse hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 live-theme-focusable"
          >
            {primaryPending
              ? "در حال اعمال…"
              : atEnd
                ? "پایان"
                : primaryLabel || "بعدی"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={confirmPresentationEnd}
        title="پایان ارائه؟"
        description="جلسه برای شرکت‌کنندگان پایان می‌یابد و نمایش نتیجه نهایی فعال می‌شود."
        confirmText="پایان ارائه"
        cancelText="ادامه ارائه"
        confirmVariant="destructive"
        isLoading={ending}
      />
    </>
  );
}

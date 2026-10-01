import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAudio } from "../../react/AudioProvider.tsx";

type ManagerTopBarProps = {
  accessCode: string;
  isConnected: boolean;
  qrOpen: boolean;
  onQrToggle: () => void;
};

export function ManagerTopBar({
  accessCode,
  isConnected,
  qrOpen,
  onQrToggle,
}: ManagerTopBarProps) {
  const navigate = useNavigate();
  const { isMuted, musicUrl, toggleMute } = useAudio();
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://proslides.ir"
        : window.location.origin;
    return `${origin}/${accessCode}`;
  }, [accessCode]);

  const displayUrl = joinUrl.replace(/^https?:\/\//, "");
  const audioUnavailable = !musicUrl;
  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header
      dir="rtl"
      className="fixed inset-x-0 top-0 z-50 flex min-h-14 items-center justify-between gap-3 border-b border-[color:var(--live-border)] live-theme-contrast-soft px-3 py-2 text-[color:var(--live-fg)] backdrop-blur-md sm:px-5"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/manager/panel")}
          className="grid min-h-11 min-w-11 place-items-center rounded-full live-theme-contrast-soft text-lg transition hover:brightness-110 live-theme-focusable focus-visible:outline-none"
          aria-label="بازگشت به پنل مدیریت"
        >
          ←
        </button>
        <button
          type="button"
          onClick={toggleMute}
          disabled={audioUnavailable}
          className="grid min-h-11 min-w-11 place-items-center rounded-full live-theme-contrast-soft text-lg transition hover:brightness-110 live-theme-focusable focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          aria-label={
            audioUnavailable
              ? "برای این ارائه صدایی تنظیم نشده است"
              : isMuted
                ? "روشن کردن صدای ارائه"
                : "بی‌صدا کردن صدای ارائه"
          }
        >
          {audioUnavailable ? "🔈" : isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs text-[color:var(--live-muted)] sm:text-sm">
          برای ورود
        </p>
        <button
          type="button"
          onClick={() => void copyJoinUrl()}
          className="max-w-full truncate rounded-control px-2 py-1 text-sm font-bold live-theme-focusable focus-visible:outline-none sm:text-base"
          dir="ltr"
          title="کپی لینک ورود"
        >
          {displayUrl}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "لینک ورود کپی شد" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-2 rounded-full live-theme-contrast-soft px-3 py-2 text-xs sm:flex"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-success" : "bg-warning"
            }`}
            aria-hidden="true"
          />
          {isConnected ? "متصل" : "در حال اتصال"}
        </div>
        <button
          type="button"
          onClick={onQrToggle}
          className="min-h-11 live-primary-action rounded-card px-3 text-sm font-bold transition live-theme-focusable focus-visible:outline-none"
          aria-expanded={qrOpen}
          aria-controls="manager-live-qr-panel"
        >
          {qrOpen ? "بستن QR" : "نمایش QR"}
        </button>
      </div>
    </header>
  );
}

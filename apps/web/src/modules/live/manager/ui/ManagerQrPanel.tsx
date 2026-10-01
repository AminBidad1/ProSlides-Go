import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { useNativeDialogLifecycle } from "../../../../shared/ui/useNativeDialogLifecycle.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";

type ManagerQrPanelProps = {
  accessCode: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ManagerQrPanel({
  accessCode,
  isOpen,
  onClose,
}: ManagerQrPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://proslides.ir"
        : window.location.origin;
    return `${origin}/${accessCode}`;
  }, [accessCode]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    void QRCode.toDataURL(joinUrl, {
      margin: 2,
      width: 280,
      errorCorrectionLevel: "M",
    }).then((value) => {
      if (active) setQrDataUrl(value);
    });

    return () => {
      active = false;
    };
  }, [isOpen, joinUrl]);

  const {
    dialogRef,
    handleCancel,
    handleClose,
  } = useNativeDialogLifecycle({
    open: isOpen,
    onRequestClose: onClose,
  });

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
    <dialog
      ref={dialogRef}
      id="manager-live-qr-panel"
      dir="rtl"
      aria-labelledby="manager-live-qr-title"
      onCancel={handleCancel}
      onClose={handleClose}
      className="fixed inset-y-0 start-0 m-0 h-dvh w-full max-w-sm border-0 border-e border-stage-border bg-stage/95 p-0 text-content-inverse shadow-feature backdrop:bg-overlay backdrop:backdrop-blur-[2px] sm:inset-y-14 sm:h-[calc(100dvh-3.5rem)] sm:w-80 sm:backdrop:bg-overlay-soft"
    >
      <div className="relative flex min-h-full flex-col items-center justify-center gap-5 p-6">
        <Button
          type="button"
          variant="inverseGhost"
          size="icon"
          autoFocus
          onClick={onClose}
          className="absolute end-4 top-4 rounded-full"
          aria-label="بستن کد QR"
        >
          ×
        </Button>

        <div className="text-center">
          <p className="text-sm text-stage-muted">ورود شرکت‌کنندگان</p>
          <h2 id="manager-live-qr-title" className="mt-1 text-2xl font-black">
            اسکن کنید و وارد شوید
          </h2>
        </div>

        <div className="grid min-h-72 min-w-72 place-items-center rounded-feature bg-surface p-4 shadow-card">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="کد QR ورود به ارائه"
              className="h-64 w-64"
            />
          ) : (
            <span className="text-sm text-content-muted" role="status">
              در حال ساخت کد QR…
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="inverseOutline"
          onClick={() => void copyJoinUrl()}
          className="max-w-full rounded-card px-4 py-3 text-center"
          dir="ltr"
          title="کپی لینک ورود"
        >
          <span className="block truncate text-sm font-bold">
            {joinUrl.replace(/^https?:\/\//, "")}
          </span>
        </Button>
        <span
          className="min-h-5 text-xs text-success-soft"
          role="status"
          aria-live="polite"
        >
          {copied ? "لینک ورود کپی شد." : ""}
        </span>
      </div>
    </dialog>
  );
}

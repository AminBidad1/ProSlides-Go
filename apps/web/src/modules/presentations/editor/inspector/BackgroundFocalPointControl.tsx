import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { firstPartyImageDeliveryURL } from "../../../../shared/media/image.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";

type BackgroundFocalPointControlProps = {
  imageUrl: string;
  backgroundColor: string;
  focalX: number;
  focalY: number;
  disabled?: boolean;
  onChange: (x: number, y: number) => void;
};

const clamp = (value: number): number =>
  Math.min(1, Math.max(0, value));

const percent = (value: number): number =>
  Math.round(clamp(value) * 100);

export default function BackgroundFocalPointControl({
  imageUrl,
  backgroundColor,
  focalX,
  focalY,
  disabled = false,
  onChange,
}: BackgroundFocalPointControlProps) {
  const activePointerRef = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    activePointerRef.current = null;
  }, [imageUrl]);

  const updateFromPointer = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    onChange(
      clamp((event.clientX - rect.left) / rect.width),
      clamp((event.clientY - rect.top) / rect.height),
    );
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (disabled || failed) return;

    const step = event.shiftKey ? 0.1 : 0.02;
    let nextX = focalX;
    let nextY = focalY;

    switch (event.key) {
      case "ArrowLeft":
        nextX -= step;
        break;
      case "ArrowRight":
        nextX += step;
        break;
      case "ArrowUp":
        nextY -= step;
        break;
      case "ArrowDown":
        nextY += step;
        break;
      case "Home":
        nextX = 0.5;
        nextY = 0.5;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(clamp(nextX), clamp(nextY));
  };

  const previewImageUrl = firstPartyImageDeliveryURL(imageUrl, "medium");
  const centered =
    Math.abs(focalX - 0.5) < 0.001 &&
    Math.abs(focalY - 0.5) < 0.001;

  return (
    <div className="mt-3 rounded-panel border border-border-subtle bg-canvas p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            نقطه تمرکز تصویر
          </p>
          <p
            id="background-focal-help"
            className="mt-1 text-xs leading-5 text-content-muted"
          >
            سوژه اصلی را مشخص کنید تا هنگام برش خودکارِ تصویر در نمایشگرهای
            مختلف تا حد ممکن داخل کادر بماند.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || centered}
          onClick={() => onChange(0.5, 0.5)}
        >
          مرکز
        </Button>
      </div>

      <button
        type="button"
        disabled={disabled || failed}
        aria-describedby="background-focal-help background-focal-position"
        aria-label="تنظیم نقطه تمرکز تصویر پس‌زمینه؛ کلیک یا جابه‌جا کنید و برای تنظیم دقیق از کلیدهای جهت استفاده کنید"
        className="relative mt-3 block aspect-video w-full touch-none overflow-hidden rounded-panel border border-border-subtle bg-surface text-start outline-none transition focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed"
        style={{ backgroundColor }}
        onPointerDown={(event) => {
          if (disabled || failed) return;
          activePointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (
            disabled ||
            failed ||
            activePointerRef.current !== event.pointerId
          ) {
            return;
          }
          updateFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          updateFromPointer(event);
          activePointerRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (activePointerRef.current === event.pointerId) {
            activePointerRef.current = null;
          }
        }}
        onKeyDown={handleKeyDown}
      >
        {failed ? (
          <span className="absolute inset-0 grid place-items-center text-content-muted">
            <span className="px-4 text-center text-xs font-semibold">
              پیش‌نمایش تصویر در دسترس نیست
            </span>
          </span>
        ) : (
          <img
            src={previewImageUrl}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{
              objectPosition:
                `${clamp(focalX) * 100}% ${clamp(focalY) * 100}%`,
            }}
            onError={() => setFailed(true)}
          />
        )}

        {!failed ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-black/10"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/55 text-white shadow-lg ring-2 ring-black/30"
              style={{
                left: `${clamp(focalX) * 100}%`,
                top: `${clamp(focalY) * 100}%`,
              }}
            >
              <span className="size-2 rounded-full bg-white" />
            </span>
          </>
        ) : null}
      </button>

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-5 text-content-muted">
        <span id="background-focal-position" aria-live="polite">
          کانون: {percent(focalX).toLocaleString("fa-IR")}٪ افقی،{" "}
          {percent(focalY).toLocaleString("fa-IR")}٪ عمودی
        </span>
        <span className="shrink-0">
          Shift + جهت: حرکت سریع
        </span>
      </div>
    </div>
  );
}

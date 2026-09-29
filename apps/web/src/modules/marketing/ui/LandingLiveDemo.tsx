import { Check, Eye, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

const OPTIONS = ["مشارکت مخاطب", "محتوای تصویری", "ریتم ارائه"] as const;
const BASE_COUNTS = [4, 3, 2] as const;
const SAMPLE_RESPONSES = BASE_COUNTS.reduce((sum, count) => sum + count, 0);

export default function LandingLiveDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);

  const answer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    setRevealed(false);
  };

  const reveal = () => {
    if (selected === null) return;
    setRevealed(true);
  };

  const reset = () => {
    setSelected(null);
    setRevealed(false);
    window.requestAnimationFrame(() => {
      firstOptionRef.current?.focus({ preventScroll: true });
    });
  };

  const counts = BASE_COUNTS.map(
    (count, index) => count + (selected === index ? 1 : 0),
  );
  const total = SAMPLE_RESPONSES + (selected === null ? 0 : 1);
  const percentages = counts.map((count) => Math.round((count / total) * 100));

  return (
    <section
      id="live-demo"
      aria-labelledby="landing-demo-title"
      className="landing-demo-shell relative mx-auto w-full max-w-2xl"
    >
      <div
        className="landing-demo-glow pointer-events-none absolute inset-8 -z-10 rounded-[40px]"
        aria-hidden="true"
      />

      <div className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-panel sm:rounded-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-black text-brand">دموی تعاملی</p>
            <h2 id="landing-demo-title" className="mt-1 text-sm font-black text-content">
              یک پاسخ بدهید و مسیر آن را تا نمایش نتیجه ببینید
            </h2>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-content-muted">
            {total.toLocaleString("fa-IR")} پاسخ نمونه
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
          <div
            data-live-demo-surface="participant"
            className="rounded-[1.5rem] border border-border-subtle bg-canvas p-3 shadow-sm sm:p-4"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-content/10" aria-hidden="true" />
            <p className="text-[11px] font-semibold text-content-muted">موبایل مخاطب</p>
            <p className="mt-1 text-sm font-black text-content">یک گزینه را انتخاب کنید</p>

            <div className="mt-3 space-y-2">
              {OPTIONS.map((option, index) => {
                const active = selected === index;
                return (
                  <button
                    key={option}
                    ref={index === 0 ? firstOptionRef : undefined}
                    type="button"
                    onClick={() => answer(index)}
                    disabled={selected !== null}
                    aria-pressed={active}
                    data-live-demo-first-action={index === 0 ? "true" : undefined}
                    className={[
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs font-semibold",
                      "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      active
                        ? "border-success-border bg-success-soft text-success-ink"
                        : "border-border-subtle bg-surface text-content hover:border-brand-border hover:bg-brand-soft disabled:opacity-55",
                    ].join(" ")}
                  >
                    <span>{option}</span>
                    {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>

            {selected !== null ? (
              <div
                className="mt-3 rounded-xl border border-success-border bg-success-soft px-3 py-2.5 text-center text-success-ink"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="text-xs font-black">پاسخ ثبت شد ✓</p>
                <p className="mt-1 text-[11px] leading-5">منتظر نمایش نتیجه بمانید.</p>
              </div>
            ) : null}
          </div>

          <div
            data-live-demo-surface="stage"
            className="relative overflow-hidden rounded-2xl border border-border-subtle bg-content p-4 text-content-inverse shadow-sm sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-brand-border">نمایش برای مخاطبان</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                {revealed ? "نتیجه نظرسنجی" : "نظرسنجی"}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-black leading-8">
              چه چیزی یک ارائه را به‌یادماندنی‌تر می‌کند؟
            </h3>

            <div className="mt-5 space-y-3">
              {OPTIONS.map((option, index) => {
                const count = counts[index];
                const percentage = percentages[index];
                return (
                  <div
                    key={option}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex min-h-5 items-center justify-between gap-3 text-xs font-semibold">
                      <span className="min-w-0 truncate">{option}</span>
                      <span
                        className={[
                          "flex shrink-0 items-baseline gap-1.5 transition-opacity",
                          revealed ? "opacity-100" : "opacity-0",
                        ].join(" ")}
                        aria-hidden={!revealed}
                      >
                        <strong className="text-sm text-white">
                          {count.toLocaleString("fa-IR")}
                        </strong>
                        <span className="font-brand text-white/65" dir="ltr">
                          {percentage.toLocaleString("fa-IR")}٪
                        </span>
                      </span>
                    </div>
                    <div
                      className={[
                        "mt-2 h-2.5 overflow-hidden rounded-full bg-white/10 transition-opacity",
                        revealed ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-brand-border transition-[width] duration-500 motion-reduce:transition-none"
                        style={{ width: revealed ? `${percentage}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] leading-6 text-white/60">
              {revealed
                ? `${total.toLocaleString("fa-IR")} پاسخ ثبت‌شده`
                : "نتیجه تا زمان نمایش ارائه‌دهنده برای مخاطبان پنهان می‌ماند."}
            </p>
          </div>
        </div>

        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-brand-soft/55 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-brand">کنترل ارائه‌دهنده</p>
            <p className="mt-0.5 text-xs font-semibold text-brand-ink">
              {selected === null
                ? "از موبایل مخاطب یک گزینه را انتخاب کنید."
                : revealed
                  ? `نتیجه با ${total.toLocaleString("fa-IR")} پاسخ نمونه نمایش داده شد.`
                  : "پاسخ ثبت شد؛ نتیجه هنوز برای مخاطبان پنهان است."}
            </p>
          </div>

          {selected !== null && !revealed ? (
            <button
              type="button"
              onClick={reveal}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-content px-3.5 py-2 text-xs font-bold text-content-inverse transition hover:bg-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Eye className="size-4" aria-hidden="true" />
              نمایش نتیجه
            </button>
          ) : revealed ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-brand-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              دوباره امتحان کنید
            </button>
          ) : null}

          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {revealed ? "نتیجه برای مخاطبان نمایش داده شد." : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

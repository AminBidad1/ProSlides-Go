import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";

const OPTIONS = ["مشارکت مخاطب", "محتوای تصویری", "ریتم ارائه"] as const;
const STAGE_VALUES = [46, 32, 22] as const;
const SAMPLE_RESPONSES = 105;

export default function LandingLiveDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const answer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    setPulseKey((value) => value + 1);
  };

  const reset = () => {
    setSelected(null);
  };

  const total = SAMPLE_RESPONSES + (selected === null ? 0 : 1);

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
            <p className="text-xs font-black text-brand">دموی زنده</p>
            <h2 id="landing-demo-title" className="mt-1 text-sm font-black text-content">
              یک پاسخ بفرستید و رسیدنش به Stage را ببینید
            </h2>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-content-muted">
            {total.toLocaleString("fa-IR")} پاسخ نمونه
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_12.5rem]" dir="ltr">
          <div
            className="relative overflow-hidden rounded-2xl border border-border-subtle bg-content p-4 text-content-inverse shadow-sm sm:p-5"
            dir="rtl"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-brand-border">نمای Stage</span>
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                  selected === null
                    ? "bg-white/10 text-white/75"
                    : "bg-brand-soft text-brand-ink",
                ].join(" ")}
              >
                {selected !== null ? (
                  <span
                    key={pulseKey}
                    className="landing-response-pulse size-2 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                ) : null}
                {selected === null ? "نتیجه زنده" : "پاسخ شما رسید"}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-black leading-8">
              چه چیزی یک ارائه را به‌یادماندنی‌تر می‌کند؟
            </h3>

            <div className="mt-5 space-y-3">
              {OPTIONS.map((option, index) => {
                const active = selected === index;
                const value = STAGE_VALUES[index];
                return (
                  <div
                    key={option}
                    className={[
                      "rounded-xl border p-3 transition",
                      active
                        ? "border-brand-border bg-white/10"
                        : "border-transparent",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{option}</span>
                        {active ? (
                          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-content-inverse">
                            پاسخ شما
                          </span>
                        ) : null}
                      </span>
                      <span className="font-brand text-white/70" dir="ltr">
                        {value.toLocaleString("fa-IR")}٪
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className={[
                          "block h-full origin-right rounded-full transition-all duration-500 motion-reduce:transition-none",
                          active ? "bg-brand" : "bg-brand-border",
                        ].join(" ")}
                        style={{
                          transform: `scaleX(${value / 100})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] leading-6 text-white/60">
              درصدها فقط تصویر یک جمع بزرگ‌اند؛ برای اینکه اثر پاسخ خودتان گم نشود،
              Stage همان گزینه را با برچسب «پاسخ شما» مشخص می‌کند.
            </p>
          </div>

          <div
            className="rounded-[1.5rem] border border-border-subtle bg-canvas p-3 shadow-sm sm:p-4"
            dir="rtl"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-content/10" aria-hidden="true" />
            <p className="text-[11px] font-semibold text-content-muted">روی موبایل مخاطب</p>
            <p className="mt-1 text-sm font-black text-content">یک گزینه را انتخاب کنید</p>

            <div className="mt-3 space-y-2">
              {OPTIONS.map((option, index) => {
                const active = selected === index;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answer(index)}
                    disabled={selected !== null}
                    data-live-demo-first-action={index === 0 ? "true" : undefined}
                    className={[
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs font-semibold",
                      "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      active
                        ? "border-success-border bg-success-soft text-success-ink"
                        : "border-border-subtle bg-surface text-content hover:border-brand-border hover:bg-brand-soft disabled:opacity-60",
                    ].join(" ")}
                  >
                    <span>{option}</span>
                    {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-brand-soft/55 px-4 py-3 sm:px-5">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs font-semibold text-brand-ink"
          >
            {selected === null
              ? "یک پاسخ نمونه بفرستید؛ هیچ چیزی خودکار تغییر نمی‌کند."
              : "پاسخ شما ثبت شد و روی Stage به‌صورت مشخص دیده می‌شود."}
          </p>

          {selected !== null ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-brand-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              دوباره امتحان کنید
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

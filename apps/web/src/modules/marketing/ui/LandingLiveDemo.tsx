import { Check, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

const OPTIONS = ["مشارکت مخاطب", "محتوای تصویری", "ریتم ارائه"] as const;
const INITIAL_VOTES = [49, 34, 22] as const;

export default function LandingLiveDemo() {
  const [votes, setVotes] = useState<number[]>([...INITIAL_VOTES]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const total = useMemo(
    () => votes.reduce((sum, value) => sum + value, 0),
    [votes],
  );

  const answer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    setVotes((current) =>
      current.map((value, itemIndex) =>
        itemIndex === index ? value + 1 : value,
      ),
    );
    setPulseKey((value) => value + 1);
  };

  const reset = () => {
    setVotes([...INITIAL_VOTES]);
    setSelected(null);
  };

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

      <div className="overflow-hidden rounded-[30px] border border-border-subtle bg-surface shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-black text-brand">دموی تعاملی</p>
            <h2 id="landing-demo-title" className="mt-1 text-sm font-black text-content">
              یک پاسخ بدهید و اثرش را روی Stage ببینید
            </h2>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-content-muted">
            {total.toLocaleString("fa-IR")} پاسخ نمونه
          </span>
        </div>

        <div
          className="grid items-stretch gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_2.75rem_13rem]"
          dir="ltr"
        >
          <div
            className="rounded-2xl border border-border-subtle bg-content p-5 text-content-inverse shadow-sm"
            dir="rtl"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-brand-border">نمای Stage</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                نتیجه زنده
              </span>
            </div>
            <h3 className="mt-4 text-lg font-black leading-8">
              چه چیزی یک ارائه را به‌یادماندنی‌تر می‌کند؟
            </h3>

            <div className="mt-5 space-y-3">
              {OPTIONS.map((option, index) => {
                const percent = Math.round((votes[index] / total) * 100);
                return (
                  <div key={option}>
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                      <span>{option}</span>
                      <span className="font-brand text-white/70" dir="ltr">
                        {percent.toLocaleString("fa-IR")}٪
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full origin-right rounded-full bg-brand-border transition-transform duration-500 motion-reduce:transition-none"
                        style={{ transform: `scaleX(${percent / 100})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="relative hidden items-center justify-center lg:flex"
            aria-hidden="true"
          >
            <div className="absolute inset-x-1 h-px bg-brand-border" />
            {pulseKey > 0 ? (
              <span
                key={pulseKey}
                className="landing-response-pulse absolute size-3 rounded-full bg-brand shadow-[0_0_0_6px_var(--color-brand-soft)]"
              />
            ) : (
              <span className="size-2 rounded-full bg-brand-border" />
            )}
          </div>

          <div
            className="rounded-[1.6rem] border border-border-subtle bg-canvas p-3 shadow-sm"
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
                    {active ? <Check className="size-4" aria-hidden="true" /> : null}
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
              ? "پاسخ‌ها فقط وقتی شما تعامل می‌کنید تغییر می‌کنند."
              : "پاسخ شما ثبت شد؛ Stage همان لحظه تغییر کرد."}
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

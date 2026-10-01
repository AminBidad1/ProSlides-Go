import { Cloud, RadioTower, Trophy, type LucideIcon } from "lucide-react";

const ACTIVITIES: Array<{
  title: string;
  description: string;
  Icon: LucideIcon;
  preview: "wordcloud" | "quiz" | "poll";
}> = [
  {
    title: "ابر واژه",
    description:
      "پاسخ‌های کوتاه جمع می‌شوند و واژه‌های پرتکرار در صفحه ارائه برجسته‌تر دیده می‌شوند.",
    Icon: Cloud,
    preview: "wordcloud",
  },
  {
    title: "کوئیز",
    description:
      "پاسخ صحیح، امتیاز هر فعالیت و رتبه‌بندی را می‌توانید در جریان ارائه نمایش دهید.",
    Icon: Trophy,
    preview: "quiz",
  },
  {
    title: "نظرسنجی",
    description:
      "نظر جمع را با یک سؤال کوتاه بگیرید و نتیجه را به‌صورت نمودار روی صفحه ارائه نشان دهید.",
    Icon: RadioTower,
    preview: "poll",
  },
];

const WORD_CLOUD_WORDS = [
  ["مشارکت", "text-xl", "text-data-violet-on-stage"],
  ["یادگیری", "text-base", "text-data-cyan-on-stage"],
  ["گفت‌وگو", "text-lg", "text-data-emerald-on-stage"],
  ["بازخورد", "text-sm", "text-data-amber-on-stage"],
  ["ایده", "text-base", "text-data-rose-on-stage"],
] as const;

const POLL_ROWS = [
  ["گزینه اول", 68, "bg-data-violet"],
  ["گزینه دوم", 47, "bg-data-cyan"],
  ["گزینه سوم", 31, "bg-data-emerald"],
] as const;

function ActivityPreview({ type }: { type: "wordcloud" | "quiz" | "poll" }) {
  if (type === "wordcloud") {
    return (
      <div className="flex min-h-36 flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 rounded-control bg-stage p-4 text-content-inverse">
        {WORD_CLOUD_WORDS.map(([word, size, tone], index) => (
          <span
            key={word}
            className={[
              "font-bold",
              size,
              tone,
              index % 2 === 0 ? "-rotate-2" : "rotate-2",
            ].join(" ")}
          >
            {word}
          </span>
        ))}
      </div>
    );
  }

  if (type === "quiz") {
    return (
      <div className="min-h-36 rounded-control bg-stage p-4 text-content-inverse">
        <p className="text-xs font-bold text-stage-accent">نتیجه نمونه</p>
        <div className="mt-3 space-y-2">
          {["مشارکت زنده مخاطبان", "متن طولانی‌تر", "اسلایدهای بیشتر"].map(
            (item, index) => (
              <div
                key={item}
                className={[
                  "rounded-control border px-3 py-2 text-xs font-semibold",
                  index === 0
                    ? "border-success-border bg-success-soft text-success-ink"
                    : "border-stage-border bg-stage-soft",
                ].join(" ")}
              >
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-36 rounded-control bg-stage p-4 text-content-inverse">
      <p className="text-xs font-bold text-stage-accent">نتیجه نمونه</p>
      <div className="mt-4 space-y-3">
        {POLL_ROWS.map(([label, value, tone]) => (
          <div key={label}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{label}</span>
              <span>{value.toLocaleString("fa-IR")}٪</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stage-soft">
              <span
                className={["block h-full rounded-full", tone].join(" ")}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingActivityPlayground() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ACTIVITIES.map(({ title, description, Icon, preview }) => (
        <article
          key={title}
          className="flex h-full flex-col rounded-card border border-border-subtle bg-surface p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold text-content">{title}</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-content-muted">
            {description}
          </p>
          <div className="mt-auto pt-5" aria-hidden="true">
            <ActivityPreview type={preview} />
          </div>
        </article>
      ))}
    </div>
  );
}

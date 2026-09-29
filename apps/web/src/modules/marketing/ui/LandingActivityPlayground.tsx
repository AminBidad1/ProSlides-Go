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

function ActivityPreview({ type }: { type: "wordcloud" | "quiz" | "poll" }) {
  if (type === "wordcloud") {
    return (
      <div className="flex min-h-36 flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-content p-4 text-content-inverse">
        {[
          ["مشارکت", "text-xl"],
          ["یادگیری", "text-base"],
          ["گفت‌وگو", "text-lg"],
          ["بازخورد", "text-sm"],
          ["ایده", "text-base"],
        ].map(([word, size], index) => (
          <span
            key={word}
            className={[
              "font-black",
              size,
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
      <div className="min-h-36 rounded-2xl bg-content p-4 text-content-inverse">
        <p className="text-[11px] font-black text-brand-border">نتیجه نمونه</p>
        <div className="mt-3 space-y-2">
          {["مشارکت زنده مخاطبان", "متن طولانی‌تر", "اسلایدهای بیشتر"].map(
            (item, index) => (
              <div
                key={item}
                className={[
                  "rounded-xl border px-3 py-2 text-xs font-bold",
                  index === 0
                    ? "border-success-border bg-success-soft text-success-ink"
                    : "border-white/10 bg-white/5",
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
    <div className="min-h-36 rounded-2xl bg-content p-4 text-content-inverse">
      <p className="text-[11px] font-black text-brand-border">نتیجه نمونه</p>
      <div className="mt-4 space-y-3">
        {[
          ["گزینه اول", 68],
          ["گزینه دوم", 47],
          ["گزینه سوم", 31],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>{String(label)}</span>
              <span>{Number(value).toLocaleString("fa-IR")}٪</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-brand-border"
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
          className="rounded-[28px] border border-border-subtle bg-surface p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-black text-content">{title}</h3>
          </div>
          <p className="mt-3 min-h-14 text-sm leading-7 text-content-muted md:min-h-20">
            {description}
          </p>
          <div className="mt-4" aria-hidden="true">
            <ActivityPreview type={preview} />
          </div>
        </article>
      ))}
    </div>
  );
}

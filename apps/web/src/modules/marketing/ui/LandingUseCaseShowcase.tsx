import {
  BarChart3,
  GraduationCap,
  Presentation,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type ScenarioId = "classroom" | "workshop" | "event" | "training";

const SCENARIOS: Array<{
  id: ScenarioId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  Icon: LucideIcon;
}> = [
  {
    id: "classroom",
    label: "کلاس و دانشگاه",
    eyebrow: "کلاس",
    title: "فهم کلاس را همان لحظه بسنجید",
    description:
      "با کوئیز و ابر واژه، قبل از رفتن به مبحث بعدی ببینید چه چیزی برای دانشجوها روشن شده و چه چیزی نیاز به توضیح بیشتری دارد.",
    tags: ["کوئیز", "ابر واژه", "نتیجه سؤال"],
    Icon: GraduationCap,
  },
  {
    id: "workshop",
    label: "جلسه و کارگاه",
    eyebrow: "جلسه",
    title: "نظر جمع را بدون شکستن ریتم جلسه ببینید",
    description:
      "نظرسنجی کوتاه را در همان جریان ارائه اجرا کنید و تصمیم یا بحث بعدی را بر اساس پاسخ واقعی گروه جلو ببرید.",
    tags: ["نظرسنجی", "نتیجه زنده", "بدون نصب"],
    Icon: UsersRound,
  },
  {
    id: "event",
    label: "رویداد و وبینار",
    eyebrow: "رویداد",
    title: "جمع بزرگ را به بخشی از ارائه تبدیل کنید",
    description:
      "مخاطبان حضوری یا آنلاین از موبایل وارد می‌شوند و با یک فعالیت کوتاه، حضورشان در خود Stage قابل مشاهده می‌شود.",
    tags: ["ابر واژه", "نظرسنجی", "کد ورود"],
    Icon: Presentation,
  },
  {
    id: "training",
    label: "آموزش سازمانی",
    eyebrow: "آموزش",
    title: "تعامل لحظه‌ای را به نتیجه قابل مرور وصل کنید",
    description:
      "فعالیت امتیازی اجرا کنید، نتیجه را در جلسه نشان دهید و بعد از پایان، گزارش و رتبه‌بندی کلی را مرور کنید.",
    tags: ["کوئیز", "رتبه‌بندی", "گزارش جلسه"],
    Icon: Trophy,
  },
];

function Preview({ scenario }: { scenario: ScenarioId }) {
  if (scenario === "classroom") {
    return (
      <div className="rounded-3xl bg-content p-5 text-content-inverse">
        <p className="text-xs font-black text-brand-border">کوئیز · سؤال نمونه</p>
        <p className="mt-4 text-lg font-black">کدام گزینه به مشارکت بیشتر کمک می‌کند؟</p>
        <div className="mt-5 grid gap-2">
          {["بازخورد لحظه‌ای", "متن طولانی‌تر", "اسلایدهای بیشتر"].map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-xl border px-3 py-3 text-sm font-bold",
                index === 0
                  ? "border-success-border bg-success-soft text-success-ink"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scenario === "workshop") {
    return (
      <div className="rounded-3xl bg-content p-5 text-content-inverse">
        <p className="text-xs font-black text-brand-border">نظرسنجی · جلسه نمونه</p>
        <p className="mt-4 text-lg font-black">اولویت بعدی تیم چیست؟</p>
        <div className="mt-5 space-y-4">
          {[
            ["تصمیم نهایی", 68],
            ["بررسی بازخورد", 49],
            ["تحلیل بیشتر", 32],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{String(label)}</span>
                <span>{Number(value).toLocaleString("fa-IR")}٪</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-brand-border" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scenario === "event") {
    return (
      <div className="rounded-3xl bg-content p-5 text-content-inverse">
        <p className="text-xs font-black text-brand-border">ابر واژه · رویداد نمونه</p>
        <p className="mt-4 text-lg font-black">این رویداد را با یک واژه توصیف کنید</p>
        <div className="mt-5 flex min-h-44 flex-wrap content-center items-center justify-center gap-4 rounded-2xl bg-white/5 p-5">
          {[
            ["تعامل", "text-3xl"],
            ["انرژی", "text-2xl"],
            ["ایده", "text-xl"],
            ["یادگیری", "text-2xl"],
            ["گفت‌وگو", "text-xl"],
          ].map(([word, size], index) => (
            <span
              key={word}
              className={`font-black ${size} ${index % 2 === 0 ? "-rotate-2" : "rotate-2"}`}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-canvas p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-brand">گزارش جلسه نمونه</p>
          <p className="mt-1 text-lg font-black text-content">نتیجه آموزش</p>
        </div>
        <BarChart3 className="size-6 text-brand" aria-hidden="true" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[["سؤال", "۴"], ["پاسخ", "۸۶"], ["میانگین", "۷۴٪"]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border-subtle bg-surface p-3 text-center">
            <div className="font-brand text-lg font-black text-content">{value}</div>
            <div className="mt-1 text-[10px] font-semibold text-content-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-border-subtle bg-surface p-4">
        <p className="text-xs font-black text-content">رتبه‌بندی کلی نمونه</p>
        <div className="mt-3 space-y-2">
          {["مریم", "علی", "سارا"].map((name, index) => (
            <div key={name} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs font-bold">
              <span>{(index + 1).toLocaleString("fa-IR")} · {name}</span>
              <span className="font-brand text-content-muted">{[760, 690, 640][index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingUseCaseShowcase() {
  const [active, setActive] = useState<ScenarioId>("classroom");
  const scenario = SCENARIOS.find((item) => item.id === active) ?? SCENARIOS[0];

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      <div
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
        role="group"
        aria-label="انتخاب سناریوی استفاده"
      >
        {SCENARIOS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => setActive(id)}
            className={[
              "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-start text-sm font-black",
              "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              active === id
                ? "border-brand bg-brand text-content-inverse shadow-panel"
                : "border-border-subtle bg-surface hover:border-brand-border hover:bg-brand-soft",
            ].join(" ")}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <article className="rounded-[30px] border border-border-subtle bg-surface p-5 shadow-panel sm:p-6">
        <p className="text-xs font-black text-brand">{scenario.eyebrow}</p>
        <h3 className="mt-2 text-2xl font-black leading-10 text-content">{scenario.title}</h3>
        <p className="mt-3 text-sm leading-7 text-content-muted">{scenario.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {scenario.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-brand-border bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-ink">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-6" aria-hidden="true">
          <Preview scenario={scenario.id} />
        </div>
      </article>
    </div>
  );
}

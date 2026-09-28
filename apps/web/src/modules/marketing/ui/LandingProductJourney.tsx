import {
  BarChart3,
  QrCode,
  RadioTower,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type JourneyId = "create" | "join" | "live" | "review";

const STEPS: Array<{
  id: JourneyId;
  eyebrow: string;
  shortTitle: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    id: "create",
    eyebrow: "۱ · بسازید",
    shortTitle: "ساخت",
    title: "محتوا و فعالیت تعاملی را کنار هم آماده کنید",
    description:
      "اسلاید، نظرسنجی، کوئیز و ابر واژه در همان جریان ارائه ساخته می‌شوند؛ نه در چند ابزار جدا.",
    Icon: SlidersHorizontal,
  },
  {
    id: "join",
    eyebrow: "۲ · دعوت کنید",
    shortTitle: "ورود",
    title: "مخاطب با یک کد وارد همان جلسه می‌شود",
    description:
      "برای شرکت در جلسه نصب لازم نیست؛ مخاطب از مرورگر موبایل وارد می‌شود و به فعالیت جاری می‌رسد.",
    Icon: QrCode,
  },
  {
    id: "live",
    eyebrow: "۳ · اجرا کنید",
    shortTitle: "اجرا",
    title: "پاسخ مخاطب روی Stage به نتیجه تبدیل می‌شود",
    description:
      "ارائه‌دهنده کنترل جریان را نگه می‌دارد و مخاطب پاسخ می‌دهد؛ نتیجه در زمان مناسب برای جمع آشکار می‌شود.",
    Icon: RadioTower,
  },
  {
    id: "review",
    eyebrow: "۴ · مرور کنید",
    shortTitle: "گزارش",
    title: "بعد از جلسه، نتیجه از بین نمی‌رود",
    description:
      "گزارش جلسه، نتیجه فعالیت‌ها و رتبه‌بندی کلی در صورت وجود فعالیت امتیازی برای مرور باقی می‌ماند.",
    Icon: BarChart3,
  },
];

function ProductScene({ id }: { id: JourneyId }) {
  if (id === "create") {
    return (
      <div className="min-h-72 rounded-3xl bg-canvas p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[4rem_1fr]">
          <div className="hidden space-y-2 rounded-2xl border border-border-subtle bg-surface p-2 sm:block">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className={[
                  "aspect-video rounded-lg border",
                  item === 1
                    ? "border-brand bg-brand-soft"
                    : "border-border-subtle bg-canvas",
                ].join(" ")}
              />
            ))}
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black text-brand">کوئیز · اسلاید ۲</span>
              <span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-bold text-brand-ink">
                تنظیمات در همان ادیتور
              </span>
            </div>
            <p className="mt-4 text-base font-black text-content">
              کدام موضوع را اول بررسی کنیم؟
            </p>
            <div className="mt-4 grid gap-2">
              {["تجربه کاربری", "تعامل زنده", "گزارش جلسه"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand-ink"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold text-content-muted">
              <SlidersHorizontal className="size-4 text-brand" aria-hidden="true" />
              زمان پاسخ، امتیازدهی و نمایش نتیجه
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (id === "join") {
    return (
      <div className="grid min-h-72 gap-4 rounded-3xl bg-content p-4 text-content-inverse sm:grid-cols-[1fr_11rem] sm:p-5">
        <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-black text-brand-border">برای ورود به جلسه</p>
          <p className="mt-4 text-3xl font-black tracking-[0.16em] sm:text-4xl" dir="ltr">
            AB12C
          </p>
          <p className="mt-3 text-sm text-white/65">کد را در proslides.ir وارد کنید</p>
          <div className="mt-6 flex items-center gap-2 text-xs text-white/70">
            <UsersRound className="size-4" aria-hidden="true" />
            بدون نصب، از مرورگر موبایل
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-surface p-4 text-content">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-content/10" />
          <p className="mt-5 text-xs font-black text-brand">ورود به جلسه</p>
          <div
            className="mt-4 rounded-xl border border-border-subtle bg-canvas px-3 py-3 text-center font-brand font-black tracking-widest"
            dir="ltr"
          >
            AB12C
          </div>
          <div className="mt-3 rounded-xl bg-brand px-3 py-3 text-center text-xs font-black text-content-inverse">
            ورود
          </div>
        </div>
      </div>
    );
  }

  if (id === "live") {
    return (
      <div className="min-h-72 rounded-3xl bg-content p-5 text-content-inverse sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black text-brand-border">Stage · نظرسنجی</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            ۲۷ پاسخ نمونه
          </span>
        </div>
        <h3 className="mt-5 text-lg font-black sm:text-xl">اولویت بعدی جلسه چیست؟</h3>
        <div className="mt-6 space-y-4">
          {[
            ["تصمیم نهایی", 72],
            ["جمع‌آوری بازخورد", 51],
            ["بررسی داده‌ها", 36],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{String(label)}</span>
                <span className="font-brand text-white/70" dir="ltr">
                  {Number(value).toLocaleString("fa-IR")}٪
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
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

  return (
    <div className="min-h-72 rounded-3xl bg-canvas p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-brand">گزارش جلسه نمونه</p>
          <h3 className="mt-1 text-lg font-black text-content">مرور نتیجه بعد از پایان</h3>
        </div>
        <span className="rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success-ink">
          جلسه پایان یافت
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[["فعالیت‌ها", "۳"], ["پاسخ‌ها", "۲۷"], ["شرکت‌کننده", "۱۲"]].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border-subtle bg-surface p-3 text-center"
          >
            <div className="font-brand text-xl font-black text-content">{value}</div>
            <div className="mt-1 text-[10px] font-semibold text-content-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-border-subtle bg-surface p-4">
        <p className="text-xs font-black text-content">رتبه‌بندی کلی نمونه</p>
        <div className="mt-3 space-y-2">
          {["مریم", "علی", "سارا"].map((name, index) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs font-bold"
            >
              <span>{(index + 1).toLocaleString("fa-IR")} · {name}</span>
              <span className="font-brand text-content-muted">{[760, 690, 640][index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingProductJourney() {
  const [active, setActive] = useState<JourneyId>("create");
  const step = STEPS.find((item) => item.id === active) ?? STEPS[0];
  const ActiveIcon = step.Icon;

  return (
    <div className="mt-10">
      <div
        className="grid grid-cols-4 gap-2 rounded-2xl border border-border-subtle bg-surface p-2 shadow-sm"
        role="group"
        aria-label="مراحل کار با ProSlides"
      >
        {STEPS.map(({ id, shortTitle, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => setActive(id)}
            className={[
              "flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:text-sm",
              active === id
                ? "bg-content text-content-inverse"
                : "text-content hover:bg-canvas",
            ].join(" ")}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{shortTitle}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
        <article className="rounded-[28px] border border-brand-border bg-surface p-5 shadow-panel sm:p-6">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ActiveIcon className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-black text-brand">{step.eyebrow}</p>
          <h3 className="mt-2 text-xl font-black leading-9 text-content">{step.title}</h3>
          <p className="mt-3 text-sm leading-7 text-content-muted">{step.description}</p>
          <p className="mt-5 text-xs font-semibold leading-6 text-content-muted">
            نمای روبه‌رو فقط با انتخاب شما عوض می‌شود؛ اسکرول صفحه آن را جابه‌جا نمی‌کند.
          </p>
        </article>

        <div
          id="landing-product-scene"
          aria-label="نمای مرحله انتخاب‌شده"
          className="overflow-hidden rounded-[30px] border border-border-subtle bg-surface p-3 shadow-panel"
        >
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <span className="text-xs font-black text-brand">نمای محصول</span>
            <span className="text-[11px] font-semibold text-content-muted">نمونه نمایشی</span>
          </div>
          <ProductScene id={active} />
        </div>
      </div>
    </div>
  );
}

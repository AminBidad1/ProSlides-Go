import {
  BarChart3,
  QrCode,
  RadioTower,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type JourneyId = "create" | "join" | "live" | "review";

const STEPS: Array<{
  id: JourneyId;
  eyebrow: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    id: "create",
    eyebrow: "۱ · بسازید",
    title: "محتوا و فعالیت تعاملی را کنار هم آماده کنید",
    description:
      "اسلاید، نظرسنجی، کوئیز و ابر واژه در همان جریان ارائه ساخته می‌شوند؛ نه در چند ابزار جدا.",
    Icon: SlidersHorizontal,
  },
  {
    id: "join",
    eyebrow: "۲ · دعوت کنید",
    title: "مخاطب با یک کد وارد همان جلسه می‌شود",
    description:
      "برای شرکت در جلسه نصب لازم نیست؛ مخاطب از مرورگر موبایل وارد می‌شود و به فعالیت جاری می‌رسد.",
    Icon: QrCode,
  },
  {
    id: "live",
    eyebrow: "۳ · زنده اجرا کنید",
    title: "پاسخ مخاطب روی Stage به نتیجه تبدیل می‌شود",
    description:
      "ارائه‌دهنده کنترل جریان را نگه می‌دارد و مخاطب پاسخ می‌دهد؛ نتیجه در زمان مناسب برای جمع آشکار می‌شود.",
    Icon: RadioTower,
  },
  {
    id: "review",
    eyebrow: "۴ · مرور کنید",
    title: "بعد از جلسه، نتیجه از بین نمی‌رود",
    description:
      "گزارش جلسه، نتیجه فعالیت‌ها و رتبه‌بندی کلی در صورت وجود فعالیت امتیازی برای مرور باقی می‌ماند.",
    Icon: BarChart3,
  },
];

function ProductScene({ id }: { id: JourneyId }) {
  if (id === "create") {
    return (
      <div className="grid h-full min-h-80 grid-cols-[4.5rem_1fr_8rem] gap-3 rounded-3xl bg-canvas p-4">
        <div className="space-y-2 rounded-2xl border border-border-subtle bg-surface p-2">
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
        <div className="flex flex-col rounded-2xl border border-border-subtle bg-surface p-5">
          <span className="text-[10px] font-black text-brand">کوئیز · اسلاید ۲</span>
          <p className="mt-5 text-base font-black text-content">
            کدام موضوع را اول بررسی کنیم؟
          </p>
          <div className="mt-5 grid gap-2">
            {["تجربه کاربری", "تعامل زنده", "گزارش جلسه"].map((item) => (
              <div key={item} className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand-ink">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-auto h-2 w-24 rounded-full bg-border-subtle" />
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface p-3">
          <p className="text-[10px] font-black text-content">تنظیمات فعالیت</p>
          <div className="mt-4 space-y-3">
            {["زمان پاسخ", "امتیازدهی", "نمایش نتیجه"].map((item) => (
              <div key={item}>
                <div className="h-2 w-16 rounded-full bg-content/15" />
                <div className="mt-1.5 h-7 rounded-lg bg-canvas" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (id === "join") {
    return (
      <div className="grid min-h-80 gap-4 rounded-3xl bg-content p-5 text-content-inverse sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-black text-brand-border">برای ورود به جلسه</p>
          <p className="mt-4 text-4xl font-black tracking-[0.16em]" dir="ltr">
            AB12C
          </p>
          <p className="mt-3 text-sm text-white/65">کد را در proslides.ir وارد کنید</p>
          <div className="mt-8 flex items-center gap-2 text-xs text-white/70">
            <UsersRound className="size-4" aria-hidden="true" />
            ورود از مرورگر موبایل
          </div>
        </div>
        <div className="rounded-[1.6rem] bg-surface p-4 text-content">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-content/10" />
          <p className="mt-6 text-xs font-black text-brand">ورود به جلسه</p>
          <div className="mt-4 rounded-xl border border-border-subtle bg-canvas px-3 py-3 text-center font-brand font-black tracking-widest" dir="ltr">
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
      <div className="min-h-80 rounded-3xl bg-content p-6 text-content-inverse">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black text-brand-border">Stage · نظرسنجی</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            ۲۷ پاسخ نمونه
          </span>
        </div>
        <h3 className="mt-5 text-xl font-black">اولویت بعدی جلسه چیست؟</h3>
        <div className="mt-7 space-y-5">
          {[
            ["تصمیم نهایی", 72],
            ["جمع‌آوری بازخورد", 51],
            ["بررسی داده‌ها", 36],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{String(label)}</span>
                <span className="font-brand text-white/70" dir="ltr">{Number(value).toLocaleString("fa-IR")}٪</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-brand-border" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-80 rounded-3xl bg-canvas p-5">
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
          <div key={label} className="rounded-2xl border border-border-subtle bg-surface p-3 text-center">
            <div className="font-brand text-xl font-black text-content">{value}</div>
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

export default function LandingProductJourney() {
  const [active, setActive] = useState<JourneyId>("create");
  const stepRefs = useRef<Record<JourneyId, HTMLElement | null>>({
    create: null,
    join: null,
    live: null,
    review: null,
  });

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.getAttribute("data-journey-id") as JourneyId);
      },
      { threshold: [0.35, 0.55, 0.75], rootMargin: "-20% 0px -38% 0px" },
    );

    Object.values(stepRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
      <div className="hidden lg:sticky lg:top-28 lg:block">
        <div
          className="overflow-hidden rounded-[32px] border border-border-subtle bg-surface p-3 shadow-panel"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <span className="text-xs font-black text-brand">نمای محصول</span>
            <span className="text-[11px] font-semibold text-content-muted">نمونه نمایشی</span>
          </div>
          <ProductScene id={active} />
        </div>
      </div>

      <div className="space-y-5">
        {STEPS.map(({ id, eyebrow, title, description, Icon }) => (
          <article
            key={id}
            ref={(node) => {
              stepRefs.current[id] = node;
            }}
            data-journey-id={id}
            className={[
              "rounded-[28px] border bg-surface p-5 transition sm:p-6 lg:min-h-64",
              active === id
                ? "border-brand-border shadow-panel"
                : "border-border-subtle",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => setActive(id)}
              className="w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-pressed={active === id}
            >
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-black text-brand">{eyebrow}</p>
              <h3 className="mt-2 text-xl font-black leading-9 text-content">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-content-muted">{description}</p>
            </button>

            <div className="mt-5 lg:hidden" aria-hidden="true">
              <ProductScene id={id} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

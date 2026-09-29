import {
  GraduationCap,
  Presentation,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const SCENARIOS: Array<{
  label: string;
  title: string;
  description: string;
  tags: string[];
  Icon: LucideIcon;
}> = [
  {
    label: "کلاس و دانشگاه",
    title: "فهم کلاس را حین ارائه بسنجید",
    description:
      "با کوئیز و ابر واژه، قبل از رفتن به مبحث بعدی ببینید چه چیزی برای دانشجوها روشن شده و چه چیزی نیاز به توضیح بیشتری دارد.",
    tags: ["کوئیز", "ابر واژه"],
    Icon: GraduationCap,
  },
  {
    label: "جلسه و کارگاه",
    title: "نظر جمع را بدون شکستن ریتم جلسه ببینید",
    description:
      "نظرسنجی کوتاه را در همان جریان ارائه اجرا کنید و بحث بعدی را بر اساس پاسخ واقعی گروه جلو ببرید.",
    tags: ["نظرسنجی", "بازخورد زنده"],
    Icon: UsersRound,
  },
  {
    label: "رویداد و وبینار",
    title: "جمع بزرگ را به بخشی از ارائه تبدیل کنید",
    description:
      "مخاطبان حضوری یا آنلاین با مرورگر وارد می‌شوند و با فعالیت‌های کوتاه، مشارکتشان روی صفحه ارائه دیده می‌شود.",
    tags: ["کد ورود", "بدون نصب"],
    Icon: Presentation,
  },
  {
    label: "آموزش سازمانی",
    title: "تعامل لحظه‌ای را به نتیجه قابل مرور وصل کنید",
    description:
      "فعالیت امتیازی اجرا کنید، نتیجه را در جلسه نشان دهید و بعد از پایان، گزارش و رتبه‌بندی کلی را مرور کنید.",
    tags: ["رتبه‌بندی", "گزارش"],
    Icon: Trophy,
  },
];

export default function LandingUseCaseShowcase() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {SCENARIOS.map(({ label, title, description, tags, Icon }) => (
        <article
          key={label}
          className="rounded-[28px] border border-border-subtle bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-black text-brand">{label}</p>
          </div>
          <h3 className="mt-4 text-xl font-black leading-9 text-content">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-content-muted">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-brand-border bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

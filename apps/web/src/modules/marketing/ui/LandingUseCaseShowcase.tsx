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
    <div className="mt-10 grid gap-x-12 sm:grid-cols-2 lg:gap-x-16">
      {SCENARIOS.map(({ label, title, description, tags, Icon }) => (
        <article
          key={label}
          className="group border-t border-border-subtle py-7 sm:py-8"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-soft/70 text-brand transition-colors group-hover:bg-brand-muted">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand">{label}</p>
              <h3 className="mt-2 text-xl font-bold leading-9 text-content">{title}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-content-muted">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border-subtle bg-canvas px-3 py-1.5 text-xs font-semibold text-content-muted"
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

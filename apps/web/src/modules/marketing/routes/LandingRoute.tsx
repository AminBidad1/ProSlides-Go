import {
  ArrowLeft,
  BarChart3,
  KeyRound,
  Languages,
  MonitorSmartphone,
  RadioTower,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { isValidAccessCode, normalizeAccessCode } from "../../../shared/forms/accessCode.ts";
import Seo from "../../../shared/ui/Seo.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import LandingActivityPlayground from "../ui/LandingActivityPlayground.tsx";
import LandingLiveDemo from "../ui/LandingLiveDemo.tsx";
import LandingProductJourney from "../ui/LandingProductJourney.tsx";
import LandingUseCaseShowcase from "../ui/LandingUseCaseShowcase.tsx";

type SectionId = "home" | "journey" | "activities" | "audience";

const NAV_ITEMS: Array<{ id: SectionId; label: string }> = [
  { id: "home", label: "خانه" },
  { id: "journey", label: "نحوه کار" },
  { id: "activities", label: "فعالیت‌ها" },
  { id: "audience", label: "کاربردها" },
];

const TRUST_ITEMS = [
  { label: "ورود با کد", Icon: KeyRound },
  { label: "بدون نصب برای مخاطب", Icon: MonitorSmartphone },
  { label: "فارسی و RTL", Icon: Languages },
  { label: "پاسخ زنده", Icon: RadioTower },
  { label: "مناسب موبایل", Icon: UsersRound },
  { label: "گزارش جلسه", Icon: BarChart3 },
] as const;

function SectionHeader({
  eyebrow,
  title,
  description,
  onTint = false,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  onTint?: boolean;
  align?: "center" | "start";
}) {
  return (
    <div
      className={[
        "w-full max-w-3xl text-center",
        align === "start" ? "lg:me-auto lg:text-start" : "mx-auto",
      ].join(" ")}
    >
      <p className="text-xs font-bold text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold leading-tight text-content md:text-4xl">
        {title}
      </h2>
      <p
        className={[
          "mt-3 text-sm leading-7 md:text-base md:leading-8",
          onTint ? "text-content-muted-on-tint" : "text-content-muted",
        ].join(" ")}
      >
        {description}
      </p>
    </div>
  );
}

function JoinForm({
  accessCode,
  error,
  errorId,
  onChange,
  onSubmit,
  mobile = false,
}: {
  accessCode: string;
  error: string;
  errorId: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  mobile?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={[
        "relative flex items-center gap-2 rounded-card border border-border-subtle bg-surface p-2 shadow-card",
        mobile ? "w-full" : "rounded-full px-2.5 py-1.5",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" dir="ltr">
        {!mobile ? (
          <span className="hidden text-xs font-semibold text-content-muted md:inline">
            proslides.ir/
          </span>
        ) : null}
        <input
          type="text"
          value={accessCode}
          onChange={(event) => onChange(event.target.value)}
          placeholder="کد ورود"
          aria-label="کد ورود"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className={[
            "min-h-10 min-w-0 flex-1 bg-transparent px-2 text-center font-brand text-sm font-semibold uppercase tracking-wider outline-none",
            "placeholder:font-sans placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-focus",
            mobile ? "w-full" : "w-28",
          ].join(" ")}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        className="h-10 shrink-0 rounded-control bg-surface-inverse px-4 text-xs font-bold text-content-inverse hover:bg-surface-inverse-soft"
      >
        ورود
      </Button>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="absolute inset-x-0 top-full z-50 mt-2 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink shadow-card"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

export default function LandingRoute() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileJoinOpen, setIsMobileJoinOpen] = useState(false);

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = accessCode.trim().toUpperCase();
    if (!isValidAccessCode(code)) {
      setJoinError("کد ورود باید بین ۵ تا ۱۲ حرف یا عدد انگلیسی باشد.");
      return;
    }
    navigate(`/${encodeURIComponent(code)}`);
  };

  const handleCodeChange = (value: string) => {
    setAccessCode(normalizeAccessCode(value));
    setJoinError("");
  };

  useEffect(() => {
    const nodes = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => Boolean(node),
    );
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: "-88px 0px -45% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    setIsMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const focusDemo = () => {
    const demo = document.getElementById("live-demo");
    const action = demo?.querySelector<HTMLButtonElement>(
      "[data-live-demo-first-action='true']",
    );
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    demo?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(() => action?.focus({ preventScroll: true }), reduced ? 0 : 450);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-content" dir="rtl">
      <Seo
        title="پرو اسلایدز | ارائه تعاملی با مشارکت زنده مخاطبان"
        description="مخاطبان با کد جلسه وارد می‌شوند، در مرورگر پاسخ می‌دهند و شما نتیجه را در زمان مناسب روی صفحه ارائه نمایش می‌دهید؛ از نظرسنجی و کوئیز تا ابر واژه و گزارش جلسه."
        canonical="https://proslides.ir/"
      />

      <div className="hidden border-b border-border-subtle bg-surface/90 backdrop-blur-xl sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-6 py-1.5">
          <span className="text-sm font-semibold text-content-muted">
            شرکت‌کننده هستید؟ با کد جلسه مستقیم وارد شوید.
          </span>
          <div className="w-80">
            <JoinForm
              accessCode={accessCode}
              error={joinError}
              errorId="join-error-desktop"
              onChange={handleCodeChange}
              onSubmit={handleJoin}
            />
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => scrollTo("home")}
            aria-label="بازگشت به ابتدای صفحه"
            dir="ltr"
            className="inline-flex min-h-11 items-center rounded-lg px-1 font-brand text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            ✱ ProSlides
          </button>

          <nav
            className="hidden items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-1 text-sm font-semibold text-content-muted md:flex"
            aria-label="بخش‌های صفحه"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                aria-current={activeSection === item.id ? "location" : undefined}
                className={[
                  "min-h-10 rounded-full px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  activeSection === item.id
                    ? "bg-brand text-content-inverse"
                    : "hover:bg-canvas hover:text-content",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 text-sm font-semibold sm:flex">
            <Link
              to="/login"
              className="min-h-11 rounded-control border border-border-subtle bg-surface px-4 py-2.5 transition hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ورود
            </Link>
            <Link
              to="/signup"
              className="min-h-11 rounded-control bg-brand px-4 py-2.5 text-content-inverse transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ثبت‌نام رایگان
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              aria-expanded={isMobileJoinOpen}
              onClick={() => {
                setIsMobileJoinOpen((open) => !open);
                setIsMenuOpen(false);
              }}
              className="min-h-11 rounded-control border border-border-subtle bg-surface px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ورود با کد
            </button>
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="landing-nav"
              onClick={() => {
                setIsMenuOpen((open) => !open);
                setIsMobileJoinOpen(false);
              }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border-subtle transition hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="sr-only">باز و بسته کردن منو</span>
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>

        {isMobileJoinOpen ? (
          <div className="border-t border-border-subtle bg-surface p-4 sm:hidden">
            <JoinForm
              accessCode={accessCode}
              error={joinError}
              errorId="join-error-mobile"
              onChange={handleCodeChange}
              onSubmit={handleJoin}
              mobile
            />
          </div>
        ) : null}

        {isMenuOpen ? (
          <nav
            id="landing-nav"
            className="border-t border-border-subtle bg-surface p-4 sm:hidden"
            aria-label="بخش‌های صفحه در موبایل"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="block min-h-11 w-full rounded-control px-4 py-3 text-start font-semibold hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {item.label}
              </button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
              <Link
                to="/login"
                className="min-h-11 rounded-control border border-border-subtle px-3 py-3 text-center text-sm font-bold"
              >
                ورود
              </Link>
              <Link
                to="/signup"
                className="min-h-11 rounded-control bg-brand px-3 py-3 text-center text-sm font-bold text-content-inverse"
              >
                ثبت‌نام رایگان
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-6 md:pb-20 md:pt-16">
        <div
          className="landing-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]"
          aria-hidden="true"
        />

        <section id="home" className="scroll-mt-32">
          <div className="grid items-center gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:gap-14">
            <div className="text-center lg:text-start">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-soft/80 px-4 py-2 text-xs font-bold text-brand-ink">
                <Sparkles className="size-4" aria-hidden="true" />
                از ارائه یک‌طرفه تا مشارکت زنده
              </p>
              <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold leading-[1.28] tracking-tight md:text-6xl md:leading-[1.16] lg:mx-0">
                ارائه‌ای بسازید که مخاطب فقط تماشاگر آن نباشد
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-content-muted md:text-lg lg:mx-0">
                مخاطبان با کد جلسه وارد می‌شوند، در مرورگر پاسخ می‌دهند و شما نتیجه را در زمان مناسب روی صفحه ارائه نمایش می‌دهید؛ از نظرسنجی و کوئیز تا ابر واژه، رتبه‌بندی و گزارش جلسه.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link
                  to="/signup"
                  className="inline-flex min-h-12 items-center gap-2 rounded-card bg-brand px-7 py-3 font-bold text-content-inverse shadow-card transition hover:-translate-y-0.5 hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none"
                >
                  رایگان شروع کنید
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={focusDemo}
                  className="min-h-12 rounded-card border border-border-subtle bg-surface px-7 py-3 font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-brand-border hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none"
                >
                  همین حالا امتحان کنید
                </button>
              </div>
            </div>

            <LandingLiveDemo />
          </div>
        </section>

        <section id="journey" className="mt-24 scroll-mt-32 md:mt-28">
          <SectionHeader
            eyebrow="از ساخت تا نتیجه"
            title="یک ارائه، یک جریان پیوسته"
            description="ProSlides فقط لحظه پاسخ‌گویی نیست؛ همان ارائه از آماده‌سازی تا ورود مخاطب، اجرای زنده و مرور نتیجه ادامه پیدا می‌کند."
            align="start"
          />
          <LandingProductJourney />
        </section>

        <section
          id="activities"
          className="landing-section-band landing-section-band-brand mt-20 scroll-mt-32 py-12 md:mt-24 md:py-16"
        >
          <SectionHeader
            eyebrow="فعالیت‌های اصلی"
            title="برای هر لحظه، یک نوع مشارکت"
            description="سه نمونه کوتاه کافی است تا تفاوت فعالیت‌ها را ببینید؛ تعامل واقعی را همان دمو ابتدای صفحه نگه داشته‌ایم تا مسیر صفحه شلوغ نشود."
            onTint
          />
          <div className="mt-10">
            <LandingActivityPlayground />
          </div>
        </section>

        <section id="audience" className="mt-20 scroll-mt-32 md:mt-24">
          <SectionHeader
            eyebrow="کاربردها"
            title="برای کلاس، جلسه، رویداد و آموزش"
            description="نوع فعالیت با موقعیت تغییر می‌کند، اما مسیر مخاطب همان است: ورود با کد، پاسخ در مرورگر و مشاهده نتیجه روی صفحه ارائه."
            align="start"
          />
          <LandingUseCaseShowcase />
        </section>

        <section
          aria-labelledby="landing-trust-title"
          className="landing-section-band landing-section-band-surface mt-16 py-10 md:mt-20 md:py-12"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold text-brand">آنچه برای اجرای یک جلسه لازم دارید</p>
            <h2 id="landing-trust-title" className="mt-3 text-2xl font-bold text-content">
              برای اجرای واقعی جلسه طراحی شده است
            </h2>
          </div>
          <div className="mt-7 grid grid-cols-2 border-y border-border-subtle sm:grid-cols-3 lg:grid-cols-6">
            {TRUST_ITEMS.map(({ label, Icon }, index) => (
              <div
                key={label}
                className={[
                  "flex min-h-24 items-center justify-center gap-2 px-3 py-4 text-center",
                  index % 2 === 1 ? "border-s border-border-subtle" : "",
                  index >= 2 ? "border-t border-border-subtle sm:border-t-0" : "",
                  index >= 3 ? "sm:border-t border-border-subtle lg:border-t-0" : "",
                  index > 0 ? "lg:border-s lg:border-border-subtle" : "",
                ].join(" ")}
              >
                <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <p className="text-xs font-bold leading-6 text-content">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="final-cta" className="mt-16 md:mt-20">
          <div className="relative overflow-hidden rounded-feature bg-surface-inverse px-6 py-10 text-content-inverse shadow-card sm:px-10">
            <div className="landing-dark-glow pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-bold text-brand-border">جلسه بعدی می‌تواند دوطرفه باشد</p>
                <h2 id="final-cta" className="mt-3 text-2xl font-bold md:text-3xl">
                  ارائه را بسازید؛ مخاطب را وارد جریان کنید.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-content-inverse-muted">
                  اولین ارائه را آماده کنید و وقتی زمان اجرا رسید، مخاطبان با یک کد وارد همان تجربه می‌شوند.
                </p>
              </div>
              <Link
                to="/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-card bg-surface px-6 py-3 text-sm font-bold text-content shadow-card transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                ایجاد حساب رایگان
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-surface/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-content-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <span className="font-brand font-bold text-content" dir="ltr">
            ✱ ProSlides
          </span>
          <div className="flex flex-wrap gap-4 font-semibold">
            <Link
              to="/team"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              آشنایی با تیم
            </Link>
            <Link
              to="/login"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ورود
            </Link>
            <Link
              to="/signup"
              className="rounded-md text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  MonitorPlay,
  QrCode,
  RadioTower,
  Sparkles,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import Seo from "../../../shared/ui/Seo.tsx";
import LandingLiveDemo from "../ui/LandingLiveDemo.tsx";

type SectionId = "home" | "experience" | "how" | "audience";
type ScenarioId = "classroom" | "workshop" | "event" | "training";

const NAV_ITEMS: Array<{ id: SectionId; label: string }> = [
  { id: "home", label: "خانه" },
  { id: "experience", label: "تجربه زنده" },
  { id: "how", label: "نحوه کار" },
  { id: "audience", label: "کاربردها" },
];

const SCENARIOS: Array<{
  id: ScenarioId;
  label: string;
  title: string;
  description: string;
  tags: string[];
}> = [
  {
    id: "classroom",
    label: "کلاس و دانشگاه",
    title: "وسط درس بفهمید چه چیزی جا افتاده و چه چیزی نه",
    description: "با سؤال کوتاه، کوئیز و ابر واژه، فهم کلاس را همان لحظه ببینید و مسیر توضیح را بر اساس پاسخ واقعی دانشجوها تنظیم کنید.",
    tags: ["کوئیز", "ابر واژه", "سؤال چندگزینه‌ای"],
  },
  {
    id: "workshop",
    label: "جلسه و کارگاه",
    title: "جلسه را از شنیدن صرف به مشارکت قابل مشاهده تبدیل کنید",
    description: "نظرها را بدون قطع جریان جلسه جمع کنید، اختلاف دیدگاه‌ها را سریع ببینید و بحث را روی چیزی متمرکز کنید که واقعاً برای گروه مهم است.",
    tags: ["نظرسنجی", "رتبه‌بندی", "سؤال چندگزینه‌ای"],
  },
  {
    id: "event",
    label: "رویداد و وبینار",
    title: "حتی در جمع بزرگ، مخاطب را بخشی از اتفاق نگه دارید",
    description: "از مخاطبان حضوری و آنلاین بازخورد بگیرید، پاسخ‌های جمع را روی پرده ببینید و بدون شکستن ریتم اجرا نبض سالن را دنبال کنید.",
    tags: ["ابر واژه", "کوئیز", "نظرسنجی"],
  },
  {
    id: "training",
    label: "آموزش سازمانی",
    title: "از مشارکت لحظه‌ای تا گزارشی که بعد از جلسه به کار می‌آید",
    description: "در طول آموزش فهم و مشارکت را بسنجید و بعد از پایان، پاسخ‌ها و نتیجه جلسه را برای مرور و تصمیم بعدی در اختیار داشته باشید.",
    tags: ["ارزیابی", "گزارش جلسه", "رتبه‌بندی"],
  },
];

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-black leading-tight text-content md:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-content-muted md:text-base md:leading-8">{description}</p>
    </div>
  );
}

function ProofCard({ icon, eyebrow, title, description, kind }: { icon: ReactNode; eyebrow: string; title: string; description: string; kind: "editor" | "live" | "report" }) {
  return (
    <article className="group overflow-hidden rounded-[30px] border border-border-subtle bg-surface p-6 shadow-panel">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
        <div>
          <p className="text-xs font-bold text-brand">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-black text-content md:text-xl">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-content-muted">{description}</p>
      <div className="mt-6 min-h-52 rounded-2xl border border-border-subtle bg-canvas p-4" aria-hidden="true">
        {kind === "editor" ? (
          <div className="grid h-full grid-cols-[4.5rem_1fr] gap-3">
            <div className="space-y-2">{[0, 1, 2].map((item) => <div key={item} className={`aspect-video rounded-lg border ${item === 1 ? "border-brand bg-brand-soft" : "border-border-subtle bg-surface"}`} />)}</div>
            <div className="flex flex-col rounded-xl border border-border-subtle bg-surface p-4"><div className="h-2 w-20 rounded-full bg-brand-border" /><div className="mt-4 h-4 w-3/4 rounded-full bg-content/10" /><div className="mt-auto grid grid-cols-2 gap-2"><div className="h-9 rounded-lg bg-brand-soft" /><div className="h-9 rounded-lg bg-brand-soft" /></div></div>
          </div>
        ) : kind === "live" ? (
          <div className="h-full rounded-xl bg-content p-5 text-content-inverse"><div className="flex justify-between text-xs"><span className="flex items-center gap-2 font-black"><span className="landing-live-dot size-2 rounded-full bg-success" />LIVE</span><span>۱۲۷ نفر</span></div><p className="mt-7 text-lg font-black">همه صدایشان شنیده می‌شود، حتی بدون گرفتن میکروفن.</p><div className="mt-5 flex items-end gap-2">{[46, 76, 58, 88, 66].map((h) => <span key={h} className="w-full rounded-t-lg bg-white/20" style={{ height: `${h}px` }}><span className="block h-2/3 w-full rounded-t-lg bg-white/70" /></span>)}</div></div>
        ) : (
          <div><div className="flex justify-between"><div className="h-3 w-24 rounded-full bg-content/15" /><span className="rounded-xl bg-success-soft px-3 py-2 text-xs font-black text-success-ink">جلسه پایان یافت</span></div><div className="mt-5 grid grid-cols-3 gap-2">{[["مشارکت", "۸۷"], ["پاسخ", "۱۴۲"], ["امتیاز", "۷۶۰"]].map(([label, value]) => <div key={label} className="rounded-xl border border-border-subtle bg-surface p-3 text-center"><div className="font-brand text-lg font-black">{value}</div><div className="mt-1 text-[10px] text-content-muted">{label}</div></div>)}</div><div className="mt-5 space-y-2">{[82, 64, 48].map((width) => <div key={width} className="h-2 rounded-full bg-brand-soft"><span className="block h-full rounded-full bg-brand" style={{ width: `${width}%` }} /></div>)}</div></div>
        )}
      </div>
    </article>
  );
}

function normalizeAccessCode(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

export default function LandingRoute() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("classroom");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scenario = SCENARIOS.find((item) => item.id === activeScenario) ?? SCENARIOS[0];

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = accessCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,12}$/.test(code)) {
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
    const nodes = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id as SectionId);
    }, { threshold: [0.25, 0.5, 0.75], rootMargin: "-88px 0px -45% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    setIsMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const focusDemo = () => {
    const demo = document.getElementById("live-demo");
    const action = demo?.querySelector<HTMLButtonElement>("[data-live-demo-first-action='true']");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    demo?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => action?.focus({ preventScroll: true }), reduced ? 0 : 450);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-content" dir="rtl">
      <Seo title="پرو اسلایدز | ارائه تعاملی با مشارکت زنده مخاطبان" description="ارائه، نظرسنجی، کوئیز، ابر واژه و مشارکت زنده را در یک جریان واحد اجرا کنید و نتیجه جلسه را بعداً مرور کنید." canonical="https://proslides.ir/" />

      <div className="border-b border-border-subtle bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-2 sm:flex-row sm:gap-3">
          <span className="text-xs font-semibold text-content-muted sm:text-sm">شرکت‌کننده هستید؟ با کد جلسه مستقیم وارد شوید.</span>
          <form onSubmit={handleJoin} className="relative flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-2.5 py-1.5 shadow-sm">
            <div className="flex items-center gap-2" dir="ltr"><span className="hidden text-[11px] font-semibold text-content-muted sm:inline">proslides.ir/</span><input type="text" value={accessCode} onChange={(event) => handleCodeChange(event.target.value)} placeholder="کد ورود" aria-label="کد ورود" aria-invalid={Boolean(joinError) || undefined} aria-describedby={joinError ? "join-error" : undefined} maxLength={12} autoComplete="off" spellCheck={false} dir="ltr" className="w-28 bg-transparent text-center font-brand text-sm font-semibold uppercase tracking-wider outline-none placeholder:font-sans placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-focus" /></div>
            <button type="submit" className="min-h-9 rounded-full bg-content px-4 py-1.5 text-xs font-bold text-content-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">ورود</button>
            {joinError ? <p id="join-error" role="alert" className="absolute start-0 top-full z-50 mt-2 w-72 rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink shadow-panel">{joinError}</p> : null}
          </form>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2"><button type="button" aria-expanded={isMenuOpen} aria-controls="landing-nav" onClick={() => setIsMenuOpen((open) => !open)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-subtle transition hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"><span className="sr-only">باز و بسته کردن منو</span><span aria-hidden="true">☰</span></button><button type="button" onClick={() => scrollTo("home")} aria-label="بازگشت به ابتدای صفحه" dir="ltr" className="inline-flex min-h-11 items-center rounded-lg px-1 font-brand text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">✱ ProSlides</button></div>
          <nav className="hidden items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-1 text-sm font-semibold text-content-muted md:flex" aria-label="بخش‌های صفحه">{NAV_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => scrollTo(item.id)} aria-current={activeSection === item.id ? "location" : undefined} className={`min-h-10 rounded-full px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${activeSection === item.id ? "bg-content text-content-inverse" : "hover:bg-canvas hover:text-content"}`}>{item.label}</button>)}</nav>
          <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm"><Link to="/login" className="min-h-11 rounded-xl border border-border-subtle bg-surface px-3 py-2.5 transition hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4">ورود</Link><Link to="/signup" className="min-h-11 rounded-xl bg-brand px-3 py-2.5 text-content-inverse transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4">ثبت‌نام رایگان</Link></div>
        </div>
        {isMenuOpen ? <nav id="landing-nav" className="border-t border-border-subtle bg-surface p-4 md:hidden" aria-label="بخش‌های صفحه در موبایل">{NAV_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => scrollTo(item.id)} className="block min-h-11 w-full rounded-xl px-4 py-3 text-start font-semibold hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{item.label}</button>)}</nav> : null}
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-24 px-4 pb-20 pt-12 sm:px-6 md:gap-32 md:pt-16">
        <div className="landing-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem]" aria-hidden="true" />
        <section id="home" className="scroll-mt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
            <div className="text-center lg:text-start"><p className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-soft/80 px-4 py-2 text-xs font-bold text-brand-ink"><Sparkles className="size-4" aria-hidden="true" />از ارائه یک‌طرفه تا گفت‌وگوی زنده</p><h1 className="mt-6 text-4xl font-black leading-[1.3] tracking-tight md:text-6xl md:leading-[1.2]">ارائه‌ای بسازید که مخاطب فقط تماشاگر آن نباشد</h1><p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-content-muted md:text-lg lg:mx-0">مخاطبان با موبایل وارد می‌شوند، پاسخ می‌دهند و نتیجه همان لحظه روی پرده تغییر می‌کند؛ از نظرسنجی و کوئیز تا ابر واژه، سؤال زنده و گزارش جلسه.</p><div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"><Link to="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand px-7 py-3 font-bold text-content-inverse shadow-panel transition hover:-translate-y-0.5 hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none">رایگان شروع کنید <ArrowLeft className="size-4" aria-hidden="true" /></Link><button type="button" onClick={focusDemo} className="min-h-12 rounded-2xl border border-border-subtle bg-surface px-7 py-3 font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-brand-border hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none">نمونه زنده را امتحان کنید</button></div><div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-content-muted lg:justify-start">{["ورود با کد بدون نصب", "پاسخ و نتیجه هم‌زمان", "مرور نتیجه بعد از جلسه"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden="true" />{item}</span>)}</div></div>
            <LandingLiveDemo />
          </div>
        </section>

        <section id="experience" className="scroll-mt-32"><SectionHeader eyebrow="محصول را ببینید، نه فقط فهرست قابلیت‌ها" title="یک جریان واحد از ساخت تا مشارکت و نتیجه" description="به‌جای جابه‌جایی میان ابزارهای جدا، همان ارائه را آماده کنید، زنده اجرا کنید و بعد از جلسه نتیجه را مرور کنید." /><div className="mt-12 grid gap-6 lg:grid-cols-3"><ProofCard icon={<WandSparkles className="size-5" aria-hidden="true" />} eyebrow="قبل از جلسه" title="ارائه را آماده کنید" description="محتوا و فعالیت تعاملی کنار هم می‌مانند تا سؤال و اسلاید بخشی از یک روایت واحد باشند." kind="editor" /><ProofCard icon={<RadioTower className="size-5" aria-hidden="true" />} eyebrow="حین جلسه" title="مخاطب را وارد جریان کنید" description="کد را نمایش دهید، پاسخ‌ها را زنده بگیرید و واکنش واقعی جمع را روی پرده ببینید." kind="live" /><ProofCard icon={<BarChart3 className="size-5" aria-hidden="true" />} eyebrow="بعد از جلسه" title="نتیجه را از دست ندهید" description="پاسخ‌ها و نتیجه جلسه باقی می‌مانند تا برای مرور عملکرد و تصمیم بعدی استفاده شوند." kind="report" /></div></section>

        <section id="how" className="scroll-mt-32"><div className="relative overflow-hidden rounded-[38px] bg-content px-5 py-10 text-content-inverse shadow-panel sm:px-8 md:px-10"><div className="landing-dark-glow pointer-events-none absolute inset-0" aria-hidden="true" /><div className="relative"><p className="text-center text-xs font-black text-brand-border">از آماده‌سازی تا بازخورد</p><h2 className="mt-3 text-center text-2xl font-black md:text-4xl">یک ارائه، چهار لحظه روشن</h2><div className="mt-12 grid gap-4 md:grid-cols-4">{[[MonitorPlay, "ارائه را آماده کنید", "محتوا و فعالیت را در یک ارائه بسازید."], [QrCode, "مخاطب را وارد کنید", "کد ورود را نمایش دهید تا از گوشی متصل شوند."], [RadioTower, "تعامل را زنده اجرا کنید", "پاسخ‌ها را بگیرید و نتیجه را همان لحظه ببینید."], [BarChart3, "نتیجه را مرور کنید", "بعد از پایان، گزارش جلسه را بررسی کنید."]].map(([Icon, title, text], index) => { const StepIcon = Icon as typeof MonitorPlay; return <article key={String(title)} className="rounded-3xl border border-white/10 bg-white/5 p-5"><span className="inline-flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5"><StepIcon className="size-6 text-brand-border" aria-hidden="true" /></span><p className="mt-4 text-xs text-white/50">مرحله {(index + 1).toLocaleString("fa-IR")}</p><h3 className="mt-1 font-black">{String(title)}</h3><p className="mt-2 text-xs leading-6 text-white/70">{String(text)}</p></article>; })}</div></div></div></section>

        <section id="audience" className="scroll-mt-32"><SectionHeader eyebrow="سناریو عوض می‌شود، منطق مشارکت نه" title="برای هر موقعیت، تعامل مناسب همان جلسه" description="یک سناریو را انتخاب کنید؛ تجربه از کلاس تا رویداد تغییر می‌کند، اما مسیر ورود، پاسخ و نتیجه ساده و آشنا می‌ماند." /><div className="mt-10 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" role="group" aria-label="انتخاب سناریوی استفاده">{SCENARIOS.map((item) => <button key={item.id} type="button" aria-pressed={activeScenario === item.id} onClick={() => setActiveScenario(item.id)} className={`min-h-12 rounded-2xl border px-4 py-3 text-start text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${activeScenario === item.id ? "border-brand bg-brand text-content-inverse shadow-panel" : "border-border-subtle bg-surface hover:bg-brand-soft"}`}>{item.label}</button>)}</div><article className="rounded-[30px] border border-border-subtle bg-surface p-6 shadow-panel"><p className="text-xs font-black text-brand">نمونه کاربرد</p><h3 className="mt-3 text-2xl font-black leading-10">{scenario.title}</h3><p className="mt-3 text-sm leading-7 text-content-muted">{scenario.description}</p><div className="mt-5 flex flex-wrap gap-2">{scenario.tags.map((tag) => <span key={tag} className="rounded-full border border-brand-border bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-ink">{tag}</span>)}</div><div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-canvas p-4">{[[UsersRound, "مخاطب"], [LayoutDashboard, "نمای زنده"], [BarChart3, "نتیجه"]].map(([Icon, label]) => { const ItemIcon = Icon as typeof UsersRound; return <div key={String(label)} className="rounded-xl border border-border-subtle bg-surface p-4 text-center"><ItemIcon className="mx-auto size-5 text-brand" aria-hidden="true" /><p className="mt-2 text-xs font-black">{String(label)}</p></div>; })}</div></article></div></section>

        <section aria-labelledby="final-cta"><div className="rounded-[34px] border border-brand-border bg-brand-soft px-6 py-10 shadow-panel sm:px-10"><div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-black text-brand">جلسه بعدی می‌تواند دوطرفه باشد</p><h2 id="final-cta" className="mt-3 text-2xl font-black md:text-3xl">ارائه را بسازید؛ مخاطب را وارد جریان کنید.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-content">اولین ارائه را آماده کنید و وقتی زمان اجرا رسید، مخاطبان با یک کد وارد همان تجربه می‌شوند.</p></div><Link to="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-content px-6 py-3 text-sm font-black text-content-inverse transition hover:bg-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">ایجاد حساب رایگان <ArrowLeft className="size-4" aria-hidden="true" /></Link></div></div></section>
      </main>

      <footer className="border-t border-border-subtle bg-surface/80"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-content-muted sm:px-6 md:flex-row md:items-center md:justify-between"><span className="font-brand font-bold text-content" dir="ltr">✱ ProSlides</span><div className="flex gap-4 font-semibold"><Link to="/team" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">آشنایی با تیم</Link><Link to="/login" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">ورود</Link><Link to="/signup" className="rounded-md text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">ثبت‌نام رایگان</Link></div></div></footer>
    </div>
  );
}
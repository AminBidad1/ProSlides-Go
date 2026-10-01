import { Link, NavLink } from "react-router-dom";

type SiteHeaderProps = {
  className?: string;
};

function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-lg font-semibold text-content before:text-xl before:content-['✱'] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      aria-label="صفحه اصلی ProSlides"
      dir="ltr"
    >
      ProSlides
    </Link>
  );
}

export default function SiteHeader({ className = "" }: SiteHeaderProps) {
  const headerClassName = [
    "border-b border-border-subtle bg-surface/95 backdrop-blur",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName} dir="rtl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="md:justify-self-start">
          <LogoMark />
        </div>

        <nav
          className="hidden items-center text-sm font-semibold md:flex md:justify-self-center"
          aria-label="ناوبری اصلی"
        >
          <NavLink
            to="/team"
            end
            className={({ isActive }) =>
              [
                "rounded-control px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                isActive
                  ? "font-bold text-content"
                  : "text-content-muted hover:text-content",
              ].join(" ")
            }
          >
            تیم ما
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm md:justify-self-end">
          <Link
            to="/login"
            className="min-h-11 rounded-control border border-border-action bg-surface px-3 py-2.5 text-content transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
          >
            ورود
          </Link>
          <Link
            to="/signup"
            className="min-h-11 rounded-control bg-brand px-3 py-2.5 text-content-inverse shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    </header>
  );
}

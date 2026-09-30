import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import notFoundIllustration from "../../assets/404.svg";
import {
  isValidAccessCode,
  normalizeAccessCode,
} from "../../shared/forms/accessCode.ts";
import SiteHeader from "../../shared/ui/SiteHeader.tsx";
import { Button } from "../../shared/ui/primitives/Button.tsx";
import { Input } from "../../shared/ui/primitives/Input.tsx";

export default function NotFoundRoute() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidAccessCode(accessCode)) return;
    navigate(`/${encodeURIComponent(accessCode)}`);
  }

  return (
    <div className="min-h-screen bg-surface text-content" dir="rtl">
      <div className="border-b border-border-subtle bg-surface-raised">
        <form
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm"
          onSubmit={handleJoin}
        >
          <label htmlFor="not-found-access-code">شرکت‌کننده هستید؟</label>
          <span className="text-xs text-content-muted" dir="ltr">
            proslides.ir/
          </span>
          <Input
            id="not-found-access-code"
            className="w-32 flex-none text-center font-brand uppercase tracking-wider"
            value={accessCode}
            onChange={(event) => setAccessCode(normalizeAccessCode(event.target.value))}
            placeholder="کد ورود"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby="not-found-access-code-help"
            dir="ltr"
          />
          <Button type="submit" size="sm" className="h-11" disabled={!isValidAccessCode(accessCode)}>
            ورود
          </Button>
          <span id="not-found-access-code-help" className="sr-only">
            کد ورود شامل ۵ تا ۱۲ حرف انگلیسی یا عدد است. ارقام فارسی نیز پذیرفته و تبدیل می‌شوند.
          </span>
        </form>
      </div>

      <SiteHeader />

      <main className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        <img src={notFoundIllustration} alt="" className="mx-auto w-full max-w-sm" />
        <div className="text-center md:text-start">
          <h1 className="text-4xl font-semibold">صفحه پیدا نشد</h1>
          <p className="mt-4 text-content-muted">
            آدرس واردشده معتبر نیست. کد ورود را بررسی کنید یا به صفحهٔ اصلی برگردید.
          </p>
          <Button type="button" size="lg" className="mt-8" onClick={() => navigate("/")}>
            بازگشت به صفحهٔ اصلی
          </Button>
        </div>
      </main>
    </div>
  );
}

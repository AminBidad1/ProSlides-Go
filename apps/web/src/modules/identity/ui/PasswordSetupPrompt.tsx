import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import Notice from "../../../shared/ui/Notice.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import { identityApi } from "../api/identityApi.ts";
import { identityErrorMessage } from "../api/identityErrors.ts";
import { currentSessionQuery } from "../api/sessionQuery.ts";
import {
  hasPasswordSetupPrompt,
  setPasswordSetupPrompt,
} from "../model/authStorage.ts";

type PromptStatus =
  | { tone: "error" | "success"; message: string }
  | null;

export function PasswordSetupPrompt() {
  const { data: user } = useQuery(currentSessionQuery());
  const [visible, setVisible] = useState(hasPasswordSetupPrompt);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<PromptStatus>(null);

  useEffect(() => {
    if (!status || status.tone === "error") return;
    const timeoutId = window.setTimeout(() => setStatus(null), 6_000);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const requestSetupLink = async () => {
    const email = user?.email?.trim();
    if (!email) {
      setStatus({
        tone: "error",
        message: "نشانی ایمیل حساب در دسترس نیست. دوباره وارد حساب شوید.",
      });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await identityApi.requestPasswordReset({ email });
      setPasswordSetupPrompt(false);
      setVisible(false);
      setStatus({
        tone: "success",
        message:
          "لینک تعیین رمز عبور ارسال شد. صندوق ورودی ایمیل خود را بررسی کنید.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: identityErrorMessage(
          error,
          "ارسال لینک تعیین رمز عبور انجام نشد.",
        ),
      });
    } finally {
      setSending(false);
    }
  };

  if (!visible && !status) return null;

  return (
    <div className="mb-6 space-y-2">
      {visible ? (
        <section className="rounded-panel border border-brand-border bg-surface px-4 py-4 text-sm text-brand-ink shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold">برای حساب خود رمز عبور تعیین کنید</h2>
              <p className="mt-1 text-xs leading-6 text-brand-strong">
                اگر با گوگل ثبت‌نام کرده‌اید، با تعیین رمز عبور می‌توانید از
                ورود ایمیلی هم استفاده کنید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void requestSetupLink()}
                disabled={sending}
                aria-busy={sending || undefined}
              >
                {sending ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                {sending ? "در حال ارسال…" : "ارسال لینک"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setVisible(false)}
                disabled={sending}
              >
                بعداً
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {status ? (
        <Notice tone={status.tone}>{status.message}</Notice>
      ) : null}
    </div>
  );
}

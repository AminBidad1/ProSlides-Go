import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

export function ParticipantWaiting({
  quiz,
  message = "منتظر مرحله بعدی هستیم",
}: {
  quiz: LivePresentationModel;
  message?: string;
}) {
  const { isStreamConnected } = useLiveSession();

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <section className="flex flex-1 items-center justify-center py-8 text-center">
        <div className="w-full live-panel rounded-showcase px-6 py-10 ">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-card border border-[color:var(--live-border)] live-theme-overlay-soft"
            aria-hidden="true"
          >
            <span className="h-3 w-3 animate-pulse rounded-full bg-[color:var(--live-fg)] ring-8 ring-[color:var(--live-border)] motion-reduce:animate-none" />
          </div>
          <p
            className="mt-5 text-xl font-black"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {message}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[color:var(--live-muted)]">
            مرحله بعدی خودکار نمایش داده می‌شود. صفحه را باز نگه دارید؛ اگر ارتباط قطع شود، تلاش برای بازیابی ادامه پیدا می‌کند.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}

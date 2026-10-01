import infiniteMark from "../../../assets/infinite.svg";
import { Button } from "../../../shared/ui/primitives/Button.tsx";

type WaitingScreenProps = {
  message?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
};

export default function WaitingScreen({
  message,
  actionLabel,
  onAction,
  busy = true,
}: WaitingScreenProps) {
  return (
    <main
      className="flex min-h-screen flex-col bg-stage text-content-inverse"
      dir="rtl"
      aria-busy={busy}
    >
      <header className="flex min-h-16 items-center justify-center px-6 py-4">
        <span
          className="font-brand text-2xl font-semibold tracking-tight"
          dir="ltr"
        >
          ProSlides
        </span>
      </header>

      <section
        className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[12vh] text-center"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <img
          src={infiniteMark}
          alt=""
          aria-hidden="true"
          className="h-32 w-32 motion-safe:animate-pulse sm:h-40 sm:w-40"
        />
        {message ? (
          <p className="max-w-xl text-lg font-medium leading-8 sm:text-xl">
            {message}
          </p>
        ) : (
          <span className="sr-only">در حال آماده‌سازی جلسه…</span>
        )}
        {actionLabel && onAction ? (
          <Button type="button" size="lg" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

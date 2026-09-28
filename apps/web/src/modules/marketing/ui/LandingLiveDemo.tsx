import { useEffect, useRef, useState } from "react";
import {
  Check,
  Cloud,
  RadioTower,
  Trophy,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

type DemoMode = "poll" | "wordcloud" | "quiz";

const POLL_OPTIONS = ["مشارکت مخاطب", "محتوای تصویری", "ریتم ارائه"] as const;
const WORDS = ["مشارکت", "یادگیری", "گفت‌وگو", "بازخورد", "ایده", "انرژی"] as const;
const QUIZ_OPTIONS = ["اسلایدهای بیشتر", "پاسخ زنده مخاطبان", "متن طولانی‌تر"] as const;

function useMotionAllowed() {
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAllowed(!media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  return allowed;
}

function ModeButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}) {
  const className = [
    "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
    active
      ? "bg-content text-content-inverse shadow-sm"
      : "bg-surface text-content-muted hover:bg-brand-soft hover:text-brand-ink",
  ].join(" ");

  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={className}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function PollView({
  votes,
  selected,
  onSelect,
}: {
  votes: number[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const total = votes.reduce((sum, value) => sum + value, 0);

  return (
    <>
      <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold text-brand">نظرسنجی زنده</p>
          <h3 className="mt-2 text-lg font-black leading-8 text-content">
            چه چیزی یک ارائه را به‌یادماندنی‌تر می‌کند؟
          </h3>
        </div>
        <div className="space-y-3">
          {POLL_OPTIONS.map((option, index) => {
            const percent = Math.round((votes[index] / total) * 100);
            return (
              <div key={option}>
                <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                  <span>{option}</span>
                  <span className="font-brand text-content-muted" dir="ltr">
                    {percent.toLocaleString("fa-IR")}٪
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-brand-soft">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: String(percent) + "%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="flex items-center gap-2 text-xs text-content-muted">
          <Zap className="size-4 text-brand" aria-hidden="true" />
          نتیجه با هر پاسخ به‌روزرسانی می‌شود.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold text-content-muted">روی موبایل مخاطب</p>
          <p className="mt-1 text-sm font-bold text-content">خودتان امتحان کنید</p>
        </div>
        {POLL_OPTIONS.map((option, index) => {
          const isSelected = selected === index;
          const className = [
            "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2",
            "text-start text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            isSelected
              ? "border-success-border bg-success-soft text-success-ink"
              : "border-border-subtle bg-surface text-content hover:border-brand-border hover:bg-brand-soft disabled:opacity-70",
          ].join(" ");

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(index)}
              disabled={selected !== null}
              data-live-demo-first-action={index === 0 ? "true" : undefined}
              className={className}
            >
              <span>{option}</span>
              {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function WordCloudView({
  chosen,
  onChoose,
}: {
  chosen: string | null;
  onChoose: (word: string) => void;
}) {
  return (
    <>
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <p className="text-xs font-bold text-brand">ابر واژه زنده</p>
        <h3 className="mt-2 text-lg font-black leading-8 text-content">
          یک ارائه خوب را با یک واژه توصیف کنید
        </h3>
        <div className="mt-5 flex min-h-40 flex-wrap content-center items-center justify-center gap-x-4 gap-y-3 rounded-2xl bg-brand-soft/65 p-5">
          {WORDS.map((word, index) => {
            const emphasized = chosen === word || index === 0 || index === 4;
            const className = [
              "landing-word-chip font-black text-brand-ink",
              emphasized ? "text-2xl" : "text-base",
              index % 2 === 0 ? "-rotate-2" : "rotate-2",
            ].join(" ");
            return <span key={word} className={className}>{word}</span>;
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold text-content-muted">روی موبایل مخاطب</p>
          <p className="mt-1 text-sm font-bold text-content">یک واژه بفرستید</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WORDS.slice(0, 4).map((word) => {
            const active = chosen === word;
            const className = [
              "min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              active
                ? "border-success-border bg-success-soft text-success-ink"
                : "border-border-subtle bg-surface text-content hover:border-brand-border hover:bg-brand-soft disabled:opacity-70",
            ].join(" ");
            return (
              <button
                key={word}
                type="button"
                disabled={chosen !== null}
                onClick={() => onChoose(word)}
                className={className}
              >
                {active ? "✓ " : ""}{word}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function QuizView({
  answer,
  onAnswer,
}: {
  answer: number | null;
  onAnswer: (index: number) => void;
}) {
  return (
    <>
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <p className="text-xs font-bold text-brand">کوئیز زنده</p>
        <h3 className="mt-2 text-lg font-black leading-8 text-content">
          کدام گزینه ارائه را از مسیر یک‌طرفه خارج می‌کند؟
        </h3>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {QUIZ_OPTIONS.map((option, index) => {
            const correct = index === 1;
            const revealed = answer !== null;
            const className = [
              "rounded-xl border p-3 text-center text-xs font-bold leading-6",
              revealed && correct
                ? "border-success-border bg-success-soft text-success-ink"
                : revealed && answer === index
                  ? "border-danger-border bg-danger-soft text-danger-ink"
                  : "border-border-subtle bg-canvas text-content",
            ].join(" ");
            return <div key={option} className={className}>{option}</div>;
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold text-content-muted">روی موبایل مخاطب</p>
          <p className="mt-1 text-sm font-bold text-content">پاسخ را انتخاب کنید</p>
        </div>
        {QUIZ_OPTIONS.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={answer !== null}
            onClick={() => onAnswer(index)}
            className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-start text-xs font-semibold text-content transition hover:border-brand-border hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-70"
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

export default function LandingLiveDemo() {
  const [mode, setMode] = useState<DemoMode>("poll");
  const [votes, setVotes] = useState([48, 35, 22]);
  const [selectedPoll, setSelectedPoll] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [participantCount, setParticipantCount] = useState(127);
  const [status, setStatus] = useState("نمونه آماده تعامل است.");
  const [userInteracted, setUserInteracted] = useState(false);
  const stepRef = useRef(0);
  const motionAllowed = useMotionAllowed();

  useEffect(() => {
    if (!motionAllowed || userInteracted || mode !== "poll") return;
    const timer = window.setInterval(() => {
      const order = [0, 1, 0, 2];
      const next = order[stepRef.current % order.length];
      stepRef.current += 1;
      setVotes((current) => current.map((value, index) => index === next ? value + 1 : value));
      setParticipantCount((current) => current + 1);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [mode, motionAllowed, userInteracted]);

  const chooseMode = (next: DemoMode) => {
    setMode(next);
    setUserInteracted(true);
    setStatus("نمای تعاملی تغییر کرد.");
  };

  const choosePoll = (index: number) => {
    if (selectedPoll !== null) return;
    setSelectedPoll(index);
    setVotes((current) => current.map((value, itemIndex) => itemIndex === index ? value + 1 : value));
    setParticipantCount((current) => current + 1);
    setUserInteracted(true);
    setStatus("پاسخ شما ثبت شد و نتیجه همان لحظه تغییر کرد.");
  };

  const chooseWord = (word: string) => {
    if (selectedWord !== null) return;
    setSelectedWord(word);
    setParticipantCount((current) => current + 1);
    setUserInteracted(true);
    setStatus("واژه شما به ابر واژه اضافه شد.");
  };

  const chooseQuiz = (index: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(index);
    setParticipantCount((current) => current + 1);
    setUserInteracted(true);
    setStatus(index === 1 ? "پاسخ درست بود؛ نتیجه بلافاصله نمایش داده شد." : "پاسخ ثبت شد؛ گزینه درست هم‌زمان مشخص شد.");
  };

  return (
    <div id="live-demo" className="landing-demo-shell relative mx-auto w-full max-w-2xl" aria-label="نمونه تعاملی ProSlides">
      <div className="landing-demo-glow pointer-events-none absolute inset-8 -z-10 rounded-[40px]" aria-hidden="true" />
      <div className="overflow-hidden rounded-[30px] border border-border-subtle bg-surface shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="landing-live-dot inline-flex size-2.5 rounded-full bg-success" aria-hidden="true" />
            <span className="text-xs font-bold text-success-ink">زنده</span>
            <span className="text-xs text-content-muted">نمونه نمایشی</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-content-muted">
            <UsersRound className="size-4 text-brand" aria-hidden="true" />
            {participantCount.toLocaleString("fa-IR")} شرکت‌کننده
          </div>
        </div>

        <div className="border-b border-border-subtle bg-canvas/80 px-3 py-3 sm:px-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="انتخاب نوع نمونه زنده">
            <ModeButton active={mode === "poll"} label="نظرسنجی" Icon={RadioTower} onClick={() => chooseMode("poll")} />
            <ModeButton active={mode === "wordcloud"} label="ابر واژه" Icon={Cloud} onClick={() => chooseMode("wordcloud")} />
            <ModeButton active={mode === "quiz"} label="کوئیز" Icon={Trophy} onClick={() => chooseMode("quiz")} />
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_13rem]">
          {mode === "poll" ? <PollView votes={votes} selected={selectedPoll} onSelect={choosePoll} /> : null}
          {mode === "wordcloud" ? <WordCloudView chosen={selectedWord} onChoose={chooseWord} /> : null}
          {mode === "quiz" ? <QuizView answer={quizAnswer} onAnswer={chooseQuiz} /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-brand-soft/45 px-4 py-3 text-xs sm:px-5">
          <span className="font-semibold text-brand-ink">ارائه و موبایل در یک جریان</span>
          <span className="text-content-muted" role="status" aria-live="polite" aria-atomic="true">{status}</span>
        </div>
      </div>

      <div className="landing-float-card pointer-events-none absolute -start-3 top-20 hidden rounded-2xl border border-border-subtle bg-surface/95 px-3 py-2 text-xs font-semibold text-content shadow-panel backdrop-blur sm:flex sm:items-center sm:gap-2" aria-hidden="true">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-success-soft text-success-ink">✓</span>
        پاسخ‌ها در لحظه می‌رسند
      </div>
    </div>
  );
}

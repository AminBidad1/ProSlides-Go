import {
  CheckCircle2,
  Cloud,
  RadioTower,
  RotateCcw,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

type Mode = "wordcloud" | "quiz" | "poll";

const MODE_OPTIONS: Array<{ id: Mode; label: string; Icon: LucideIcon }> = [
  { id: "wordcloud", label: "ابر واژه", Icon: Cloud },
  { id: "quiz", label: "کوئیز", Icon: Trophy },
  { id: "poll", label: "نظرسنجی", Icon: RadioTower },
];

const INITIAL_WORDS = [
  { text: "مشارکت", count: 3 },
  { text: "یادگیری", count: 2 },
  { text: "گفت‌وگو", count: 2 },
  { text: "بازخورد", count: 1 },
  { text: "ایده", count: 2 },
  { text: "انرژی", count: 1 },
];

const QUIZ_OPTIONS = [
  "اسلایدهای بیشتر",
  "مشارکت زنده مخاطبان",
  "متن طولانی‌تر",
] as const;

const POLL_OPTIONS = ["نظرسنجی", "کوئیز", "ابر واژه"] as const;
const INITIAL_POLL = [14, 9, 11] as const;

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
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
        "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active
          ? "bg-content text-content-inverse shadow-sm"
          : "bg-surface text-content-muted hover:bg-brand-soft hover:text-brand-ink",
      ].join(" ")}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function WordCloudDemo() {
  const [words, setWords] = useState(INITIAL_WORDS);
  const [draft, setDraft] = useState("");
  const [lastWord, setLastWord] = useState<string | null>(null);
  const [status, setStatus] = useState("یک واژه بنویسید و آن را وارد ابر کنید.");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const word = draft.trim().replace(/\s+/g, " ").slice(0, 20);
    if (!word) {
      setStatus("برای ارسال، یک واژه یا عبارت کوتاه وارد کنید.");
      return;
    }

    setWords((current) => {
      const existing = current.findIndex((item) => item.text === word);
      if (existing === -1) return [...current, { text: word, count: 1 }];
      return current.map((item, index) =>
        index === existing ? { ...item, count: item.count + 1 } : item,
      );
    });
    setLastWord(word);
    setDraft("");
    setStatus(`«${word}» وارد ابر واژه شد.`);
  };

  const reset = () => {
    setWords(INITIAL_WORDS);
    setDraft("");
    setLastWord(null);
    setStatus("ابر واژه به نمونه اولیه برگشت.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
      <div className="rounded-3xl border border-border-subtle bg-surface p-5 shadow-sm">
        <p className="text-xs font-black text-brand">روی موبایل مخاطب</p>
        <h3 className="mt-2 text-lg font-black text-content">
          یک ارائه خوب را با یک واژه توصیف کنید
        </h3>
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="landing-word" className="text-xs font-bold text-content-muted">
            واژه شما
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="landing-word"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 20))}
              maxLength={20}
              placeholder="مثلاً خلاقیت"
              dir="auto"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border-subtle bg-canvas px-3 text-sm font-semibold outline-none transition focus:border-brand-border focus:ring-2 focus:ring-focus"
            />
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-content-inverse transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              ارسال
            </button>
          </div>
        </form>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 min-h-6 text-xs font-semibold text-content-muted"
        >
          {status}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          شروع دوباره
        </button>
      </div>

      <div className="rounded-3xl border border-border-subtle bg-content p-5 text-content-inverse shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black text-brand-border">Stage · ابر واژه</p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/75">
            نمونه تعاملی
          </span>
        </div>
        <div className="mt-5 flex min-h-64 flex-wrap content-center items-center justify-center gap-x-5 gap-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          {words.map((word, index) => {
            const size =
              word.count >= 3
                ? "text-3xl"
                : word.count === 2
                  ? "text-2xl"
                  : "text-lg";
            return (
              <span
                key={word.text}
                className={[
                  "font-black text-white",
                  size,
                  index % 2 === 0 ? "-rotate-2" : "rotate-2",
                  lastWord === word.text ? "landing-word-enter" : "",
                ].join(" ")}
                dir="auto"
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuizDemo() {
  const [answer, setAnswer] = useState<number | null>(null);
  const correctIndex = 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
      <div className="rounded-3xl border border-border-subtle bg-surface p-5 shadow-sm">
        <p className="text-xs font-black text-brand">روی موبایل مخاطب</p>
        <h3 className="mt-2 text-lg font-black text-content">
          کدام مورد ارائه را از حالت یک‌طرفه خارج می‌کند؟
        </h3>
        <div className="mt-5 space-y-2">
          {QUIZ_OPTIONS.map((option, index) => {
            const selected = answer === index;
            return (
              <button
                key={option}
                type="button"
                disabled={answer !== null}
                onClick={() => setAnswer(index)}
                className={[
                  "min-h-11 w-full rounded-xl border px-3 py-2 text-start text-sm font-semibold",
                  "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  selected
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-border-subtle bg-canvas hover:border-brand-border disabled:opacity-65",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mt-4 min-h-6 text-xs font-semibold text-content-muted"
        >
          {answer === null
            ? "یک گزینه را انتخاب کنید."
            : answer === correctIndex
              ? "درست است؛ نتیجه و پاسخ صحیح روی Stage آشکار شد."
              : "پاسخ ثبت شد؛ Stage گزینه صحیح را هم‌زمان نشان می‌دهد."}
        </p>
        {answer !== null ? (
          <button
            type="button"
            onClick={() => setAnswer(null)}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            دوباره امتحان کنید
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border-subtle bg-content p-5 text-content-inverse shadow-panel">
        <p className="text-xs font-black text-brand-border">Stage · نتیجه کوئیز</p>
        <h3 className="mt-3 text-lg font-black leading-8">
          کدام مورد ارائه را از حالت یک‌طرفه خارج می‌کند؟
        </h3>
        <div className="mt-5 grid gap-3">
          {QUIZ_OPTIONS.map((option, index) => {
            const revealed = answer !== null;
            const correct = index === correctIndex;
            const chosenWrong = answer === index && !correct;
            return (
              <div
                key={option}
                className={[
                  "flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold",
                  revealed && correct
                    ? "border-success-border bg-success-soft text-success-ink"
                    : chosenWrong
                      ? "border-danger-border bg-danger-soft text-danger-ink"
                      : "border-white/10 bg-white/5 text-white",
                ].join(" ")}
              >
                <span>{option}</span>
                {revealed && correct ? (
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PollDemo() {
  const [votes, setVotes] = useState<number[]>([...INITIAL_POLL]);
  const [selected, setSelected] = useState<number | null>(null);
  const total = useMemo(() => votes.reduce((sum, value) => sum + value, 0), [votes]);

  const answer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    setVotes((current) =>
      current.map((value, itemIndex) =>
        index === itemIndex ? value + 1 : value,
      ),
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
      <div className="rounded-3xl border border-border-subtle bg-surface p-5 shadow-sm">
        <p className="text-xs font-black text-brand">روی موبایل مخاطب</p>
        <h3 className="mt-2 text-lg font-black text-content">
          برای شروع تعامل کدام فعالیت را ترجیح می‌دهید؟
        </h3>
        <div className="mt-5 space-y-2">
          {POLL_OPTIONS.map((option, index) => (
            <button
              key={option}
              type="button"
              disabled={selected !== null}
              onClick={() => answer(index)}
              className={[
                "min-h-11 w-full rounded-xl border px-3 py-2 text-start text-sm font-semibold",
                "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected === index
                  ? "border-success-border bg-success-soft text-success-ink"
                  : "border-border-subtle bg-canvas hover:border-brand-border disabled:opacity-65",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mt-4 min-h-6 text-xs font-semibold text-content-muted"
        >
          {selected === null
            ? "یک گزینه را انتخاب کنید."
            : "پاسخ شما ثبت شد و نمودار تغییر کرد."}
        </p>
        {selected !== null ? (
          <button
            type="button"
            onClick={() => {
              setVotes([...INITIAL_POLL]);
              setSelected(null);
            }}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            شروع دوباره
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border-subtle bg-content p-5 text-content-inverse shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-brand-border">Stage · نظرسنجی</p>
          <span className="text-xs text-white/65">
            {total.toLocaleString("fa-IR")} پاسخ نمونه
          </span>
        </div>
        <div className="mt-6 space-y-4">
          {POLL_OPTIONS.map((option, index) => {
            const percent = Math.round((votes[index] / total) * 100);
            return (
              <div key={option}>
                <div className="flex items-center justify-between gap-4 text-sm font-bold">
                  <span>{option}</span>
                  <span className="font-brand text-white/70" dir="ltr">
                    {percent.toLocaleString("fa-IR")}٪
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full origin-right rounded-full bg-brand-border transition-transform duration-500 motion-reduce:transition-none"
                    style={{ transform: `scaleX(${percent / 100})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LandingActivityPlayground() {
  const [mode, setMode] = useState<Mode>("wordcloud");

  return (
    <div className="rounded-[34px] border border-border-subtle bg-canvas p-3 shadow-panel sm:p-5">
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="انتخاب فعالیت برای نمونه تعاملی"
      >
        {MODE_OPTIONS.map(({ id, label, Icon }) => (
          <ModeButton
            key={id}
            active={mode === id}
            label={label}
            Icon={Icon}
            onClick={() => setMode(id)}
          />
        ))}
      </div>

      {mode === "wordcloud" ? <WordCloudDemo /> : null}
      {mode === "quiz" ? <QuizDemo /> : null}
      {mode === "poll" ? <PollDemo /> : null}
    </div>
  );
}

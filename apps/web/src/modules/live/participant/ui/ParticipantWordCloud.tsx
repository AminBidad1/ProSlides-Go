import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRequestId } from "../../api/liveApi.ts";
import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { resolveQuestionTimer } from "../../model/questionTimer.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { LiveMediaImage } from "../../ui/LiveMediaImage.tsx";
import { Textarea } from "../../../../shared/ui/primitives/Textarea.tsx";
import { ParticipantShell } from "../ParticipantShell.tsx";
import {
  clearAnswerDraft,
  clearPendingAnswer,
  readAnswerDraft,
  readPendingAnswer,
  saveAnswerDraft,
  savePendingAnswer,
} from "../pendingAnswerStorage.ts";

type SubmitState =
  | "idle"
  | "sending"
  | "retryable"
  | "sent"
  | "rejected"
  | "expired";

type WordCloudResponse =
  | { text: string }
  | { entries: string[] };

type PendingTextAttempt = {
  scope: string;
  requestId: string;
  response: WordCloudResponse;
};

const responseEntries = (value: string): string[] =>
  value
    .split(/\r?\n/u)
    .map((entry) => entry.normalize("NFKC").trim())
    .filter(Boolean);

const responseTerms = (value: string): string[] =>
  (
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}\p{M}\u200c\u200d'’]+/gu) ?? []
  )
    .map((raw) =>
      raw.replace(/^['’\u200c\u200d]+|['’\u200c\u200d]+$/gu, ""),
    )
    .filter(Boolean);

export function ParticipantWordCloud({
  roomId,
  question,
  quiz,
}: {
  roomId?: string;
  question: LegacyQuestionSlide;
  quiz: LivePresentationModel;
}) {
  const {
    submitAnswer,
    isConnected,
    isStreamConnected,
    connectionError,
    snapshot,
  } = useLiveSession();
  const identity = String(question.question_id ?? question.slide_id ?? "");
  const timerScope = String(roomId ?? "unknown") + ":" + identity + ":" + String(question.run_id ?? "na");
  const entryBased = question.response_aggregation === "entry_frequency";
  const maxLength = Math.max(
    1,
    Number(
      entryBased
        ? question.response_max_entry_length ?? 30
        : question.response_max_length ?? 80,
    ),
  );
  const maxWords = Math.max(
    1,
    Number(
      entryBased
        ? question.response_max_entries ?? 3
        : question.response_max_words ?? 3,
    ),
  );
  const [value, setValue] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const questionRef = useRef(question);
  questionRef.current = question;
  const activeScopeRef = useRef(timerScope);
  activeScopeRef.current = timerScope;
  const timerRef = useRef({ anchorStartMs: Date.now(), totalSeconds: 0 });
  const remainingRef = useRef(0);
  const pendingRef = useRef<PendingTextAttempt | null>(null);
  const inFlightAttemptRef = useRef<string | null>(null);
  const restoredPendingRef = useRef(false);
  const wasStreamConnectedRef = useRef(isStreamConnected);

  useEffect(() => {
    const resolved = resolveQuestionTimer({
      question: questionRef.current,
      roomId,
      role: "player",
    });
    timerRef.current = {
      anchorStartMs: resolved.anchorStartMs,
      totalSeconds: resolved.totalSeconds,
    };
    remainingRef.current = resolved.remainingSeconds;
    setTimeLeft(resolved.remainingSeconds);
    setTotalSeconds(resolved.totalSeconds);
    const restored = readPendingAnswer(roomId, timerScope);
    const draft = readAnswerDraft(roomId, timerScope);
    const restoredText =
      restored && "entries" in restored.response
        ? restored.response.entries.join("\n")
        : restored && "text" in restored.response
          ? restored.response.text
          : draft && "text" in draft
            ? draft.text
            : "";
    setValue(restoredText);
    setSubmitState(restored ? "retryable" : "idle");
    setSubmitMessage(
      restored
        ? "ارسال قبلی پس از تازه‌سازی در حال بازیابی است."
        : "",
    );
    pendingRef.current =
      restored?.request_id &&
      ("text" in restored.response || "entries" in restored.response)
        ? {
            scope: timerScope,
            requestId: restored.request_id,
            response: "entries" in restored.response
              ? { entries: restored.response.entries }
              : { text: restored.response.text },
          }
        : null;
    restoredPendingRef.current = Boolean(restored);
    inFlightAttemptRef.current = null;
  }, [roomId, timerScope]);

  useEffect(() => {
    const alreadySubmitted =
      snapshot?.role === "participant" &&
      snapshot.has_responded &&
      String(snapshot.session.active_item_id ?? "") === identity;
    if (!alreadySubmitted) return;

    pendingRef.current = null;
    clearPendingAnswer(roomId, timerScope);
    clearAnswerDraft(roomId, timerScope);
    restoredPendingRef.current = false;
    inFlightAttemptRef.current = null;
    setSubmitState("sent");
    setSubmitMessage("پاسخ شما قبلاً ثبت شده است.");
  }, [identity, roomId, snapshot, timerScope]);

  useEffect(() => {
    if (!identity || totalSeconds <= 0) return;
    const tick = () => {
      const elapsed = (Date.now() - timerRef.current.anchorStartMs) / 1000;
      const remaining = Math.max(
        0,
        timerRef.current.totalSeconds - elapsed,
      );
      remainingRef.current = remaining;
      setTimeLeft(remaining);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [identity, totalSeconds]);

  const terms = useMemo(() => responseTerms(value), [value]);
  const entries = useMemo(() => responseEntries(value), [value]);
  const entryDrafts = useMemo(() => {
    const lines = value.split("\n");
    return Array.from({ length: maxWords }, (_, index) => lines[index] ?? "");
  }, [maxWords, value]);

  const updateDraftValue = (nextValue: string) => {
    setValue(nextValue);
    if (nextValue.trim()) {
      saveAnswerDraft(roomId, timerScope, { text: nextValue });
    } else {
      clearAnswerDraft(roomId, timerScope);
    }
    if (submitState === "retryable") {
      pendingRef.current = null;
      restoredPendingRef.current = false;
      clearPendingAnswer(roomId, timerScope);
      setSubmitState("idle");
      setSubmitMessage("");
    }
  };
  const normalized = value.normalize("NFKC").trim();
  const tooLong = entryBased
    ? entries.some((entry) => Array.from(entry).length > maxLength)
    : Array.from(normalized).length > maxLength;
  const tooManyWords = entryBased
    ? entries.length > maxWords
    : terms.length > maxWords;
  const locked = ["sending", "sent", "rejected", "expired"].includes(submitState);
  const canSubmit =
    Boolean(normalized) &&
    !tooLong &&
    !tooManyWords &&
    (entryBased ? entries.length > 0 : terms.length > 0) &&
    timeLeft > 0 &&
    !locked;

  const send = useCallback(
    async (attempt: PendingTextAttempt) => {
      if (
        attempt.scope !== activeScopeRef.current ||
        inFlightAttemptRef.current !== null ||
        remainingRef.current <= 0
      ) {
        return;
      }

      const attemptKey = attempt.scope + ":" + attempt.requestId;
      restoredPendingRef.current = false;
      inFlightAttemptRef.current = attemptKey;
      setSubmitState("sending");
      setSubmitMessage("در حال ارسال پاسخ…");
      try {
        const outcome = await submitAnswer({
          request_id: attempt.requestId,
          activity_item_id: identity,
          response: attempt.response,
        });

        if (activeScopeRef.current !== attempt.scope) {
          // The presenter already advanced to another Activity while this HTTP
          // request was in flight. Retire the old attempt without mutating the
          // new Activity's UI state.
          clearPendingAnswer(roomId, attempt.scope);
          clearAnswerDraft(roomId, attempt.scope);
          return;
        }

        if (outcome === true) {
          pendingRef.current = null;
          clearPendingAnswer(roomId, attempt.scope);
          clearAnswerDraft(roomId, attempt.scope);
          setSubmitState("sent");
          setSubmitMessage("پاسخ شما ثبت شد.");
        } else if (outcome === "rejected") {
          pendingRef.current = null;
          clearPendingAnswer(roomId, attempt.scope);
          clearAnswerDraft(roomId, attempt.scope);
          setSubmitState("rejected");
          setSubmitMessage("پاسخ پذیرفته نشد؛ محدودیت پاسخ یا زمان را بررسی کنید.");
        } else {
          pendingRef.current = attempt;
          setSubmitState("retryable");
          setSubmitMessage("ارسال کامل نشد. متن شما حفظ شده است؛ دوباره تلاش کنید.");
        }
      } finally {
        if (inFlightAttemptRef.current === attemptKey) {
          inFlightAttemptRef.current = null;
        }
      }
    },
    [identity, roomId, submitAnswer],
  );

  const submit = async () => {
    if (!canSubmit) return;
    const response: WordCloudResponse = entryBased
      ? { entries }
      : { text: normalized };
    const attempt: PendingTextAttempt = {
      scope: timerScope,
      requestId: createRequestId(),
      response,
    };
    pendingRef.current = attempt;
    savePendingAnswer(roomId, timerScope, {
      request_id: attempt.requestId,
      activity_item_id: identity,
      response: attempt.response,
    });
    await send(attempt);
  };

  const retry = async () => {
    const attempt = pendingRef.current;
    if (attempt) await send(attempt);
  };

  useEffect(() => {
    const reconnected =
      !wasStreamConnectedRef.current && isStreamConnected;
    wasStreamConnectedRef.current = isStreamConnected;

    const restoredPending =
      restoredPendingRef.current &&
      isConnected &&
      snapshot?.role === "participant" &&
      !snapshot.has_responded &&
      String(snapshot.session.active_item_id ?? "") === identity;

    if (!reconnected && !restoredPending) return;
    if (
      submitState !== "retryable" ||
      !pendingRef.current ||
      pendingRef.current.scope !== timerScope ||
      remainingRef.current <= 0 ||
      snapshot?.role !== "participant" ||
      snapshot.has_responded ||
      String(snapshot.session.active_item_id ?? "") !== identity
    ) {
      return;
    }

    restoredPendingRef.current = false;
    void send(pendingRef.current);
  }, [
    identity,
    isConnected,
    isStreamConnected,
    send,
    snapshot,
    submitState,
    timerScope,
  ]);

  useEffect(() => {
    const retryWhenOnline = () => {
      if (
        submitState !== "retryable" ||
        !pendingRef.current ||
        pendingRef.current.scope !== timerScope ||
        remainingRef.current <= 0 ||
        snapshot?.role !== "participant" ||
        snapshot.has_responded ||
        String(snapshot.session.active_item_id ?? "") !== identity
      ) {
        return;
      }
      void send(pendingRef.current);
    };

    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [identity, send, snapshot, submitState, timerScope]);

  useEffect(() => {
    // The timer setup effect updates remainingRef before React commits the
    // corresponding timeLeft state. Avoid expiring a freshly mounted or newly
    // advanced Word Cloud during that one-render synchronization window.
    if (timeLeft > 0 || remainingRef.current > 0 || locked) return;
    pendingRef.current = null;
    clearPendingAnswer(roomId, timerScope);
    clearAnswerDraft(roomId, timerScope);
    setSubmitState("expired");
    setSubmitMessage(
      normalized
        ? "زمان پاسخ‌گویی پایان یافت و پاسخ ارسال نشد."
        : "زمان پاسخ‌گویی پایان یافت.",
    );
  }, [locked, normalized, roomId, timeLeft, timerScope]);

  const progressPercent =
    totalSeconds > 0
      ? Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100))
      : 0;
  const urgent = timeLeft > 0 && timeLeft <= 10;
  const responseIsAuthoritative =
    submitState === "sent" ||
    (snapshot?.role === "participant" && snapshot.has_responded === true);
  const connectionNotice =
    !isStreamConnected && connectionError
      ? responseIsAuthoritative
        ? "پاسخ شما ثبت شده است؛ ارتباط زنده در حال بازیابی است."
        : submitState === "retryable" || Boolean(normalized)
          ? "ارتباط زنده ناپایدار است؛ پاسخ شما روی این دستگاه حفظ شده است."
          : "ارتباط زنده ناپایدار است؛ در حال بازیابی ارتباط هستیم."
      : null;

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        {connectionNotice ? (
          <p
            role="alert"
            className="mb-3 rounded-control border border-warning/60 bg-warning/15 px-4 py-3 text-center text-sm"
          >
            {connectionNotice}
          </p>
        ) : null}

        <div className="flex flex-1 flex-col live-panel rounded-showcase p-4  sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>
              {entryBased
                ? `تا ${maxWords.toLocaleString("fa-IR")} عبارت کوتاه`
                : `تا ${maxWords.toLocaleString("fa-IR")} واژه بنویسید`}
            </span>
            <span
              className={
                "shrink-0 rounded-full border px-3 py-1 " +
                (urgent
                  ? "border-warning/50 bg-warning/15"
                  : "border-transparent live-theme-overlay-soft")
              }
              role="timer"
              aria-live="off"
              aria-label={Math.ceil(timeLeft).toLocaleString("fa-IR") + " ثانیه باقی مانده"}
            >
              {Math.ceil(timeLeft).toLocaleString("fa-IR")} ثانیه
            </span>
          </div>

          <div
            className="my-4 h-2 overflow-hidden rounded-full live-theme-contrast-soft"
            role="progressbar"
            aria-label="زمان باقی‌مانده"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div
              className="h-full rounded-full bg-[color:var(--live-fg)] transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: progressPercent + "%" }}
            />
          </div>

          {question.question_title ? (
            <p
              className="text-center text-sm font-bold text-[color:var(--live-muted)]"
              dir="auto"
            >
              {question.question_title}
            </p>
          ) : null}
          <h1
            className="mt-1 text-center text-2xl font-black leading-10 sm:text-3xl"
            dir="auto"
          >
            {question.question_text || "ابر واژه"}
          </h1>
          {question.image_url ? (
            <LiveMediaImage
              src={question.image_url}
              image={question.image}
              preferred="medium"
              alt="تصویر پرسش ابر واژه"
              className="mx-auto mt-4 max-h-48 w-auto max-w-full rounded-panel object-contain"
            />
          ) : null}

          {entryBased ? (
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">عبارت‌های ابر واژه</legend>
              {entryDrafts.map((entry, index) => {
                const entryTooLong = Array.from(entry.normalize("NFKC").trim()).length > maxLength;
                return (
                  <label
                    key={index}
                    className="flex items-center gap-3 rounded-panel border-2 border-[color:var(--live-border)] live-theme-overlay-soft px-4 py-2.5 focus-within:border-[color:var(--live-control-border)] focus-within:ring-2 focus-within:ring-[color:var(--live-focus)]"
                  >
                    <span className="shrink-0 text-xs font-black text-[color:var(--live-muted)]">
                      {(index + 1).toLocaleString("fa-IR")}
                    </span>
                    <input
                      dir="auto"
                      type="text"
                      value={entry}
                      disabled={locked || timeLeft <= 0}
                      onChange={(event) => {
                        const next = [...entryDrafts];
                        next[index] = event.target.value.replace(/[\r\n]+/gu, " ");
                        updateDraftValue(next.join("\n").replace(/\n+$/u, ""));
                      }}
                      placeholder={index === 0 ? "مثلاً: هوش مصنوعی" : "عبارت دیگر…"}
                      className="min-w-0 flex-1 bg-transparent py-1.5 text-base font-bold outline-none placeholder:text-[color:var(--live-muted)] disabled:opacity-60"
                      aria-label={`عبارت ${(index + 1).toLocaleString("fa-IR")}`}
                      aria-invalid={entryTooLong}
                      maxLength={maxLength + 1}
                    />
                    <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--live-muted)]">
                      {Array.from(entry.normalize("NFKC").trim()).length.toLocaleString("fa-IR")}
                      /{maxLength.toLocaleString("fa-IR")}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <label className="mt-6 block">
              <span className="sr-only">پاسخ متنی شما</span>
              <Textarea
                tone="live"
                resize="none"
                dir="auto"
                rows={4}
                value={value}
                disabled={locked || timeLeft <= 0}
                onChange={(event) => updateDraftValue(event.target.value)}
                placeholder="واژه‌های خود را بنویسید…"
                className="min-h-32 rounded-panel border-2 px-4 py-3 text-lg font-bold disabled:opacity-60"
                aria-invalid={tooLong || tooManyWords}
              />
            </label>
          )}

          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[color:var(--live-muted)]">
            <span>
              {(entryBased ? entries.length : terms.length).toLocaleString("fa-IR")} / {maxWords.toLocaleString("fa-IR")} {entryBased ? "عبارت" : "واژه"}
            </span>
            <span>
              {entryBased
                ? `حداکثر ${maxLength.toLocaleString("fa-IR")} نویسه برای هر عبارت`
                : `${Array.from(normalized).length.toLocaleString("fa-IR")} / ${maxLength.toLocaleString("fa-IR")} نویسه`}
            </span>
          </div>
          {(tooLong || tooManyWords) && (
            <p role="alert" className="mt-2 text-sm font-bold text-warning">
              {tooManyWords
                ? entryBased
                  ? "تعداد عبارت‌ها از محدودیت این فعالیت بیشتر است."
                  : "تعداد واژه‌ها از محدودیت این فعالیت بیشتر است."
                : entryBased
                  ? "یکی از عبارت‌ها بیش از حد طولانی است."
                  : "متن پاسخ بیش از حد طولانی است."}
            </p>
          )}

          <div className="mt-auto pt-5">
            {submitState === "sent" ? (
              <div
                className="rounded-panel border border-success/40 bg-success/15 px-5 py-4 text-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-lg font-black">پاسخ ثبت شد ✓</p>
                <p className="mt-1 text-sm text-[color:var(--live-muted)]">
                  پاسخ شما ذخیره شده است. منتظر نمایش نتیجه بمانید.
                </p>
              </div>
            ) : submitState === "expired" || timeLeft <= 0 ? (
              <div
                className="rounded-panel border border-[color:var(--live-border)] live-theme-overlay-subtle px-5 py-4 text-center"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="text-lg font-black">پاسخ‌گویی پایان یافت</p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--live-muted)]">
                  {submitState === "expired" && submitMessage
                    ? submitMessage
                    : "دیگر امکان ثبت پاسخ وجود ندارد."}
                </p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--live-muted)]">
                  منتظر نمایش نتیجه توسط ارائه‌دهنده بمانید.
                </p>
              </div>
            ) : submitState === "retryable" ? (
              <button
                type="button"
                onClick={() => void retry()}
                className="min-h-14 w-full rounded-panel live-primary-action live-theme-focusable px-5 text-base font-black transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none"
              >
                تلاش دوباره برای ارسال
              </button>
            ) : (
              <button
                type="button"
                className="min-h-14 w-full rounded-panel live-primary-action live-theme-focusable px-5 text-lg font-black transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
                onClick={() => void submit()}
                disabled={!canSubmit}
              >
                {submitState === "sending" ? "در حال ارسال…" : "ثبت پاسخ"}
              </button>
            )}
            {submitMessage &&
            submitState !== "sent" &&
            submitState !== "expired" ? (
              <p
                role={submitState === "rejected" ? "alert" : "status"}
                className="mt-3 text-center text-sm text-[color:var(--live-muted)]"
              >
                {submitMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </ParticipantShell>
  );
}

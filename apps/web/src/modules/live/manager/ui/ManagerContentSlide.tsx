import { useState } from "react";

import { isContentSlide } from "../../model/presentationFlow.ts";
import type { LegacyContentSlide } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ManagerControls } from "./ManagerControls.tsx";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { ManagerStageProps } from "./types.ts";

type ManagerContentSlideProps = ManagerStageProps & {
  content: LegacyContentSlide | null;
};

export function ManagerContentSlide({
  quiz,
  content,
  currentSlide,
  totalSlides,
  onNext,
  onEndGame,
}: ManagerContentSlideProps) {
  const {
    isStreamConnected,
    sendNavigation,
    sendEnd,
  } = useLiveSession();
  const [showQr, setShowQr] = useState(false);

  const definition = quiz.slides[currentSlide - 1];
  const source =
    content ?? (isContentSlide(definition) ? definition : null);

  const handleNext = async () => {
    const nextSlide = quiz.slides[currentSlide];
    if (!nextSlide) {
      if (await sendEnd()) onEndGame();
      return;
    }

    if (!(await sendNavigation("next", { slide: nextSlide }))) return;
    onNext();
  };

  const handleEnd = async () => {
    if (await sendEnd()) onEndGame();
  };

  const theme = participantTheme(quiz);

  return (
    <div
      dir="rtl"
      className="h-screen h-dvh overflow-hidden bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <ManagerTopBar
        accessCode={quiz.access_code}
        isConnected={isStreamConnected}
        qrOpen={showQr}
        onQrToggle={() => setShowQr((value) => !value)}
      />
      <ManagerQrPanel
        accessCode={quiz.access_code}
        isOpen={showQr}
        onClose={() => setShowQr(false)}
      />

      <main
        className={`flex h-full min-h-0 items-center overflow-hidden px-4 pb-20 pt-16 transition-[padding] sm:px-6 sm:pb-20 sm:pt-[4.5rem] ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <article className="mx-auto flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-5 text-center shadow-2xl backdrop-blur sm:p-8">
          {!source ? (
            <p role="status" className="text-[color:var(--live-muted)]">
              در حال همگام‌سازی محتوای اسلاید…
            </p>
          ) : (
            <>
              {source.title ? (
                <h1 className="line-clamp-2 shrink-0 text-3xl font-black sm:text-5xl" dir="auto">
                  {source.title}
                </h1>
              ) : null}
              {source.content_text ? (
                <p
                  className="mx-auto mt-4 max-h-[28dvh] max-w-3xl overflow-hidden whitespace-pre-wrap text-base leading-7 text-[color:var(--live-muted)] sm:text-lg sm:leading-8"
                  dir="auto"
                >
                  {source.content_text}
                </p>
              ) : null}
              {source.content_image_url ? (
                <img
                  src={source.content_image_url}
                  alt={source.title || "تصویر اسلاید توضیحی"}
                  className="mx-auto mt-5 min-h-0 max-h-[44dvh] max-w-full rounded-2xl object-contain shadow-xl"
                />
              ) : null}
            </>
          )}
        </article>
      </main>

      <ManagerControls
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onNext={handleNext}
        onEnd={handleEnd}
      />
    </div>
  );
}

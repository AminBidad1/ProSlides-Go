import { useState } from "react";

import { isContentSlide } from "../../model/presentationFlow.ts";
import type { LegacyContentSlide } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ProjectedContentCard } from "../../ui/ProjectedContentCard.tsx";
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
      await sendEnd();
      return;
    }

    await sendNavigation("next", { slide: nextSlide });
  };

  const handleEnd = async () => {
    await sendEnd();
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
        {!source ? (
          <div
            className="mx-auto rounded-2xl border border-white/10 bg-[color:var(--live-surface)] px-6 py-5 text-center text-[color:var(--live-muted)]"
            role="status"
          >
            در حال همگام‌سازی محتوای اسلاید…
          </div>
        ) : (
          <ProjectedContentCard content={source} />
        )}
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

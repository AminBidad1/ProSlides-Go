import { lazy, Suspense } from "react";

import type { PlayerLastActive } from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import { ParticipantActivityClosed } from "../participant/ui/ParticipantActivityClosed.tsx";
import { ParticipantActivityResult } from "../participant/ui/ParticipantActivityResult.tsx";
import { ParticipantContentSlide } from "../participant/ui/ParticipantContentSlide.tsx";
import { ParticipantFinalResult } from "../participant/ui/ParticipantFinalResult.tsx";
import { ParticipantJoinPage } from "../participant/ui/ParticipantJoinPage.tsx";
import { ParticipantLeaderboard } from "../participant/ui/ParticipantLeaderboard.tsx";
import { ParticipantQuestion } from "../participant/ui/ParticipantQuestion.tsx";
const ParticipantWordCloud = lazy(() =>
  import("../participant/ui/ParticipantWordCloud.tsx").then((module) => ({
    default: module.ParticipantWordCloud,
  })),
);

import { ParticipantWaiting } from "../participant/ui/ParticipantWaiting.tsx";
import { normalizeLiveSlide } from "../runtime/protocol.ts";
import type { LiveSnapshot } from "../api/types.ts";

type PlayerViewProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  questionResults: LegacyQuestionResult | null;
  snapshot: LiveSnapshot | null;
  hasLeaderboard: boolean;
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
};

export function PlayerPresentationView({
  roomId,
  quiz,
  currentQuestion,
  currentContent,
  questionResults,
  snapshot,
  hasLeaderboard,
  hasSeenActiveSlide,
  lastActive,
}: PlayerViewProps) {
  if (currentContent) {
    return (
      <ParticipantContentSlide
        quiz={quiz}
        content={currentContent}
      />
    );
  }

  if (
    currentQuestion &&
    snapshot?.role === "participant" &&
    snapshot.session.activity_phase === "revealed"
  ) {
    return (
      <ParticipantActivityResult
        quiz={quiz}
        question={currentQuestion}
        result={questionResults}
      />
    );
  }

  if (
    snapshot?.role === "participant" &&
    snapshot.session.state === "presenting" &&
    snapshot.session.stage_view === "item" &&
    snapshot.session.activity_phase === "closed"
  ) {
    const normalizedClosedItem = normalizeLiveSlide(
      snapshot.active_item,
      snapshot.session,
    );
    const activeItemId = String(snapshot.session.active_item_id ?? "");
    const rememberedQuestion =
      lastActive?.kind === "question" &&
      String(
        lastActive.payload.question_id ??
          lastActive.payload.slide_id ??
          "",
      ) === activeItemId
        ? lastActive.payload
        : null;
    const closedQuestion =
      normalizedClosedItem?.item_kind === "activity"
        ? normalizedClosedItem
        : rememberedQuestion;

    return (
      <ParticipantActivityClosed
        quiz={quiz}
        question={closedQuestion}
        hasResponded={snapshot.has_responded}
      />
    );
  }

  if (currentQuestion) {
    return currentQuestion.activity_kind === "text" ? (
      <Suspense fallback={<ParticipantWaiting quiz={quiz} />}>
        <ParticipantWordCloud
          roomId={roomId}
          question={currentQuestion}
          quiz={quiz}
        />
      </Suspense>
    ) : (
      <ParticipantQuestion
        roomId={roomId}
        question={currentQuestion}
        quiz={quiz}
      />
    );
  }

  if (
    snapshot?.role === "participant" &&
    snapshot.session.state === "ended"
  ) {
    return <ParticipantFinalResult quiz={quiz} />;
  }

  if (hasLeaderboard) {
    return <ParticipantLeaderboard quiz={quiz} />;
  }

  if (
    hasSeenActiveSlide &&
    lastActive?.kind === "question" &&
    snapshot?.session?.state === "presenting" &&
    snapshot.session.activity_phase === "accepting"
  ) {
    const freshRemaining = snapshot.session.remaining_seconds;
    const fallbackQuestion =
      freshRemaining == null
        ? lastActive.payload
        : {
            ...lastActive.payload,
            remaining_seconds: freshRemaining,
          };
    const fallbackTimer = resolveQuestionTimer({
      question: fallbackQuestion,
      roomId,
      role: "player",
    });

    if (
      fallbackTimer.totalSeconds > 0 &&
      fallbackTimer.remainingSeconds > 0
    ) {
      return fallbackQuestion.activity_kind === "text" ? (
        <Suspense fallback={<ParticipantWaiting quiz={quiz} />}>
          <ParticipantWordCloud
            roomId={roomId}
            question={fallbackQuestion}
            quiz={quiz}
          />
        </Suspense>
      ) : (
        <ParticipantQuestion
          roomId={roomId}
          question={fallbackQuestion}
          quiz={quiz}
        />
      );
    }
  }

  if (hasSeenActiveSlide) {
    return <ParticipantWaiting quiz={quiz} />;
  }

  return <ParticipantJoinPage roomId={roomId} quiz={quiz} />;
}

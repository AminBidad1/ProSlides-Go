import type { LiveState, StageView } from "../api/types.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import {
  findContentSlideIndex,
  findQuestionSlideIndex,
  findSlideIndexById,
  type ManagerPresentationView,
} from "../model/presentationFlow.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";

type UseManagerPresentationControllerOptions = {
  enabled: boolean;
  quiz: LivePresentationModel;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  sessionState?: LiveState;
  sessionStageView?: StageView;
  activeItemId?: string | null;
};

export const isManagerProjectionReady = ({
  enabled,
  sessionState,
  sessionStageView,
  currentQuestion,
  currentContent,
}: Pick<
  UseManagerPresentationControllerOptions,
  | "enabled"
  | "sessionState"
  | "sessionStageView"
  | "currentQuestion"
  | "currentContent"
>): boolean =>
  !enabled ||
  sessionState === "draft" ||
  sessionState === "lobby" ||
  sessionState === "ended" ||
  sessionStageView === "overall_ranking" ||
  currentQuestion !== null ||
  currentContent !== null;

export type ManagerPresentationController = {
  view: ManagerPresentationView;
  currentSlide: number;
  totalSlides: number;
  isSynced: boolean;
};

const resolvedSlideNumber = ({
  quiz,
  activeItemId,
  currentQuestion,
  currentContent,
}: Pick<
  UseManagerPresentationControllerOptions,
  "quiz" | "activeItemId" | "currentQuestion" | "currentContent"
>): number => {
  const activeIndex = findSlideIndexById(quiz.slides, activeItemId);
  if (activeIndex >= 0) return activeIndex + 1;

  if (currentQuestion?.question_id != null) {
    const questionIndex = findQuestionSlideIndex(
      quiz.slides,
      currentQuestion.question_id,
    );
    if (questionIndex >= 0) return questionIndex + 1;
  }

  if (currentContent) {
    const contentIndex = findContentSlideIndex(quiz.slides, currentContent);
    if (contentIndex >= 0) return contentIndex + 1;
  }

  return 1;
};

export function useManagerPresentationController({
  enabled,
  quiz,
  currentQuestion,
  currentContent,
  sessionState,
  sessionStageView,
  activeItemId,
}: UseManagerPresentationControllerOptions): ManagerPresentationController {
  const totalSlides = quiz.slides.length;
  const currentSlide = resolvedSlideNumber({
    quiz,
    activeItemId,
    currentQuestion,
    currentContent,
  });
  const isSynced = isManagerProjectionReady({
    enabled,
    sessionState,
    sessionStageView,
    currentQuestion,
    currentContent,
  });

  let view: ManagerPresentationView = "ManagerJoinPage";
  if (sessionState === "ended") {
    view = "ManagerFinalLeaderboard";
  } else if (sessionState === "draft" || sessionState === "lobby") {
    view = "ManagerJoinPage";
  } else if (sessionStageView === "overall_ranking") {
    view = "ManagerLeaderBoard";
  } else if (currentContent) {
    view = "ManagerContentSlide";
  } else if (currentQuestion) {
    view = "ManagerPickAnswerQuestion";
  }

  return {
    view,
    currentSlide,
    totalSlides,
    isSynced,
  };
}

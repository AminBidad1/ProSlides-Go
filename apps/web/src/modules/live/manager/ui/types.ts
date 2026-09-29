import type { LivePresentationModel } from "../../model/presentation.ts";

export type ManagerStageProps = {
  sessionId?: string;
  quiz: LivePresentationModel;
  currentSlide: number;
  totalSlides: number;
};

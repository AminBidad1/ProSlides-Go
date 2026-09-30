import {
  presentationTheme,
  type PresentationThemeInput,
} from "../../../shared/styles/presentationTheme.ts";

export type ParticipantQuizTheme = PresentationThemeInput;

export const participantTheme = (
  input?: ParticipantQuizTheme,
) => presentationTheme(input, { surface: "participant" });

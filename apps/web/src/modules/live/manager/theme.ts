import {
  presentationTheme,
  type PresentationThemeInput,
} from "../../../shared/styles/presentationTheme.ts";

export const managerTheme = (
  input?: PresentationThemeInput,
) => presentationTheme(input, { surface: "manager" });

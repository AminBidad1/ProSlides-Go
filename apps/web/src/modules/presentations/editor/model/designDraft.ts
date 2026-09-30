import {
  DEFAULT_PRESENTATION_ACCENT,
  DEFAULT_VISUALIZATION_PALETTE,
  findPresentationThemePreset,
  normalizeVisualizationPalette,
  presentationTheme,
  type PresentationThemePreset,
} from "../../../../shared/styles/presentationTheme.ts";
import type { EditorPresentation } from "../../model/editor.ts";

export const DESIGN_LIMITS = {
  imageUrl: 4_096,
} as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HTTP_URL = /^https?:\/\//i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIRST_PARTY_MEDIA_URL =
  /^\/api\/v1\/media\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/content$/i;

export type DesignDraft = {
  presentationId: string;
  revision: number;
  backgroundColor: string;
  backgroundImageUrl: string;
  backgroundImageAssetId: string;
  backgroundImageFocalX: number;
  backgroundImageFocalY: number;
  textColor: string;
  accentColor: string;
  visualizationPalette: string[];
};

type DesignDraftState = {
  baseline: DesignDraft;
  draft: DesignDraft;
};

type DesignDraftAction =
  | { type: "reset"; draft: DesignDraft }
  | { type: "saved"; draft: DesignDraft }
  | { type: "background-color"; value: string }
  | { type: "background-image"; url: string; assetId: string }
  | { type: "background-image-focal"; x: number; y: number }
  | { type: "text-color"; value: string }
  | { type: "accent-color"; value: string }
  | { type: "visualization-palette"; value: string[] }
  | { type: "apply-preset"; preset: PresentationThemePreset };

type DesignValidationIssue = {
  code: string;
  field:
    | "background_color"
    | "background_image"
    | "background_image_focal"
    | "text_color"
    | "accent_color"
    | "visualization_palette";
  message: string;
};

const normalizeHex = (value: unknown, fallback: string): string => {
  const candidate = String(value ?? "").trim();
  return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback;
};

const normalizeFocalPoint = (value: unknown): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1
    ? value
    : 0.5;

const readableForeground = (
  backgroundColor: string,
  requestedTextColor: string,
): string =>
  presentationTheme({
    background: {
      color: backgroundColor,
      text_color: requestedTextColor,
    },
    text_color: requestedTextColor,
  }).foreground;

export const createDesignDraft = (
  presentation: EditorPresentation,
): DesignDraft => {
  const backgroundColor = normalizeHex(
    presentation.background_color,
    "#f7f7fb",
  );
  const requestedText = normalizeHex(
    presentation.text_color,
    "#111827",
  );

  return {
    presentationId: presentation.quiz_id,
    revision: presentation.revision,
    backgroundColor,
    backgroundImageUrl: String(
      presentation.background_image_url || "",
    ).trim(),
    backgroundImageAssetId: String(
      presentation.background_image_asset_id || "",
    ).trim(),
    backgroundImageFocalX: normalizeFocalPoint(
      presentation.background_image_focal_x,
    ),
    backgroundImageFocalY: normalizeFocalPoint(
      presentation.background_image_focal_y,
    ),
    textColor: readableForeground(backgroundColor, requestedText),
    accentColor: normalizeHex(
      presentation.accent_color,
      DEFAULT_PRESENTATION_ACCENT,
    ),
    visualizationPalette: normalizeVisualizationPalette(
      presentation.visualization_palette,
      DEFAULT_VISUALIZATION_PALETTE,
    ),
  };
};

const patchDraft = (
  state: DesignDraftState,
  patch: Partial<DesignDraft>,
): DesignDraftState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

export function designDraftReducer(
  state: DesignDraftState,
  action: DesignDraftAction,
): DesignDraftState {
  switch (action.type) {
    case "reset":
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "background-color": {
      const backgroundColor = normalizeHex(
        action.value,
        state.draft.backgroundColor,
      );
      return patchDraft(state, {
        backgroundColor,
        textColor: readableForeground(
          backgroundColor,
          state.draft.textColor,
        ),
      });
    }
    case "background-image":
      return patchDraft(state, {
        backgroundImageUrl: action.url.trim(),
        backgroundImageAssetId: action.assetId.trim(),
      });
    case "background-image-focal":
      return patchDraft(state, {
        backgroundImageFocalX: normalizeFocalPoint(action.x),
        backgroundImageFocalY: normalizeFocalPoint(action.y),
      });
    case "accent-color":
      return patchDraft(state, {
        accentColor: normalizeHex(
          action.value,
          state.draft.accentColor,
        ),
      });
    case "visualization-palette":
      return patchDraft(state, {
        visualizationPalette: normalizeVisualizationPalette(
          action.value,
          state.draft.visualizationPalette,
        ),
      });
    case "apply-preset":
      return patchDraft(state, {
        backgroundColor: action.preset.background,
        textColor: action.preset.foreground,
        accentColor: action.preset.accent,
        visualizationPalette: [...action.preset.palette],
      });
    case "text-color": {
      const requested = normalizeHex(
        action.value,
        state.draft.textColor,
      );
      return patchDraft(state, {
        textColor: readableForeground(
          state.draft.backgroundColor,
          requested,
        ),
      });
    }
    default:
      return state;
  }
}

export const designDraftEquals = (
  left: DesignDraft,
  right: DesignDraft,
): boolean =>
  left.presentationId === right.presentationId &&
  left.revision === right.revision &&
  left.backgroundColor === right.backgroundColor &&
  left.backgroundImageUrl === right.backgroundImageUrl &&
  left.backgroundImageAssetId === right.backgroundImageAssetId &&
  left.backgroundImageFocalX === right.backgroundImageFocalX &&
  left.backgroundImageFocalY === right.backgroundImageFocalY &&
  left.textColor === right.textColor &&
  left.accentColor === right.accentColor &&
  left.visualizationPalette.length === right.visualizationPalette.length &&
  left.visualizationPalette.every((color, index) => color === right.visualizationPalette[index]);

export const validateDesignDraft = (
  draft: DesignDraft,
): DesignValidationIssue[] => {
  const issues: DesignValidationIssue[] = [];

  if (!HEX_COLOR.test(draft.backgroundColor)) {
    issues.push({
      code: "background_color_invalid",
      field: "background_color",
      message: "رنگ پس‌زمینه معتبر نیست.",
    });
  }

  if (!HEX_COLOR.test(draft.accentColor)) {
    issues.push({
      code: "accent_color_invalid",
      field: "accent_color",
      message: "رنگ تأکیدی معتبر نیست.",
    });
  }

  if (
    draft.visualizationPalette.length < 3 ||
    draft.visualizationPalette.length > 8 ||
    draft.visualizationPalette.some((color) => !HEX_COLOR.test(color))
  ) {
    issues.push({
      code: "visualization_palette_invalid",
      field: "visualization_palette",
      message: "پالت نمودار باید بین ۳ تا ۸ رنگ معتبر داشته باشد.",
    });
  }

  if (!HEX_COLOR.test(draft.textColor)) {
    issues.push({
      code: "text_color_invalid",
      field: "text_color",
      message: "رنگ متن معتبر نیست.",
    });
  }

  if (
    !Number.isFinite(draft.backgroundImageFocalX) ||
    !Number.isFinite(draft.backgroundImageFocalY) ||
    draft.backgroundImageFocalX < 0 ||
    draft.backgroundImageFocalX > 1 ||
    draft.backgroundImageFocalY < 0 ||
    draft.backgroundImageFocalY > 1
  ) {
    issues.push({
      code: "background_image_focal_invalid",
      field: "background_image_focal",
      message: "نقطه تمرکز تصویر معتبر نیست.",
    });
  }

  const image = draft.backgroundImageUrl.trim();
  const assetID = draft.backgroundImageAssetId.trim();
  if (
    assetID &&
    !UUID.test(assetID)
  ) {
    issues.push({
      code: "background_image_asset_invalid",
      field: "background_image",
      message: "شناسه تصویر پس‌زمینه معتبر نیست.",
    });
  }

  if (Array.from(image).length > DESIGN_LIMITS.imageUrl) {
    issues.push({
      code: "background_image_too_long",
      field: "background_image",
      message: "آدرس تصویر پس‌زمینه بیش از حد طولانی است.",
    });
  } else if (
    image &&
    !HTTP_URL.test(image) &&
    !FIRST_PARTY_MEDIA_URL.test(image)
  ) {
    issues.push({
      code: "background_image_invalid",
      field: "background_image",
      message: "آدرس تصویر پس‌زمینه معتبر نیست.",
    });
  }

  return issues;
};

export const designDraftToUpdate = (
  draft: DesignDraft,
) => {
  const issues = validateDesignDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }

  return {
    background_color: draft.backgroundColor,
    background_image_url: draft.backgroundImageUrl,
    background_image_asset_id: draft.backgroundImageAssetId,
    background_image_focal_x: draft.backgroundImageFocalX,
    background_image_focal_y: draft.backgroundImageFocalY,
    text_color: draft.textColor,
    accent_color: draft.accentColor,
    visualization_palette: draft.visualizationPalette,
    revision: draft.revision,
  };
};


export const activeDesignPreset = (
  draft: DesignDraft,
): PresentationThemePreset | null =>
  findPresentationThemePreset({
    background: draft.backgroundColor,
    foreground: draft.textColor,
    accent: draft.accentColor,
    palette: draft.visualizationPalette,
  });

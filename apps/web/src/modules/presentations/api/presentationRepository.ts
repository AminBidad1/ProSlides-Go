import {
  DEFAULT_PRESENTATION_ACCENT,
  DEFAULT_PRESENTATION_BACKGROUND,
  DEFAULT_PRESENTATION_FOREGROUND,
  DEFAULT_VISUALIZATION_PALETTE,
  normalizeVisualizationPalette,
} from "../../../shared/styles/presentationTheme.ts";
import type {
  EditorPresentation,
  EditorSlide,
} from "../model/editor.ts";
import { requestJson, type ApiRequestOptions } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";
import {
  editorSlideFromTransport,
  editorSlideToTransportDefinition,
} from "./editorItemTransportRegistry.ts";

export {
  editorSlideToTransportDefinition as editorSlideToDefinition,
} from "./editorItemTransportRegistry.ts";

type SlideDTO = components["schemas"]["Slide"];
type PresentationDTO = components["schemas"]["Presentation"];
type PresentationSummaryDTO = components["schemas"]["PresentationSummary"];
type AccessCodeResultDTO = components["schemas"]["AccessCodeResult"];


type RequestOptions = ApiRequestOptions;
const request = requestJson;

const revisionHeaders = (revision?: number): Record<string, string> =>
  Number.isInteger(revision) && Number(revision) > 0 ? { "If-Match": String(revision) } : {};

const numberValue = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const focalValue = (value: unknown): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1
    ? value
    : 0.5;

export const presentationToEditor = (presentation: PresentationDTO): EditorPresentation => {
  const settings = presentation.settings || {};
  const backgroundColor =
    typeof settings.background_color === "string"
      ? settings.background_color
      : DEFAULT_PRESENTATION_BACKGROUND;
  const backgroundImage =
    typeof settings.background_image_url === "string"
      ? settings.background_image_url
      : "";
  const backgroundImageAssetID =
    typeof settings.background_image_asset_id === "string"
      ? settings.background_image_asset_id
      : "";
  const backgroundImageFocalX = focalValue(
    settings.background_image_focal_x,
  );
  const backgroundImageFocalY = focalValue(
    settings.background_image_focal_y,
  );
  const textColor =
    typeof settings.text_color === "string"
      ? settings.text_color
      : DEFAULT_PRESENTATION_FOREGROUND;
  const accentColor =
    typeof settings.accent_color === "string"
      ? settings.accent_color
      : DEFAULT_PRESENTATION_ACCENT;
  const visualizationPalette = normalizeVisualizationPalette(
    settings.visualization_palette,
    DEFAULT_VISUALIZATION_PALETTE,
  );
  const musicURL =
    typeof settings.music_url === "string"
      ? settings.music_url
      : "";

  return {
    quiz_id: presentation.id,
    revision: numberValue(presentation.revision, 1),
    access_code:
      typeof presentation.access_code === "string"
        ? presentation.access_code
        : "",
    title: presentation.title,
    quiz_name: presentation.title,
    background_color: backgroundColor,
    background_image_url: backgroundImage,
    background_image_asset_id: backgroundImageAssetID,
    background_image_focal_x: backgroundImageFocalX,
    background_image_focal_y: backgroundImageFocalY,
    text_color: textColor,
    accent_color: accentColor,
    visualization_palette: visualizationPalette,
    music_url: musicURL,
    background: {
      color: backgroundColor,
      image: backgroundImage,
      focal_x: backgroundImageFocalX,
      focal_y: backgroundImageFocalY,
      text_color: textColor,
    },
    slides: (presentation.slides || []).map(editorSlideFromTransport),
    created_at: presentation.created_at,
    last_update: presentation.updated_at,
  };
};

const mutationQueues = new Map<string, Promise<void>>();
const queueSlideMutation = <T>(presentationID: string, slideID: string, mutation: () => Promise<T>): Promise<T> => {
  const key = `${presentationID}:${slideID}`;
  const previous = mutationQueues.get(key) || Promise.resolve();
  const next = previous.then(mutation, mutation);
  const tracked = next.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (mutationQueues.get(key) === tracked) mutationQueues.delete(key);
  });
  mutationQueues.set(key, tracked);
  return next;
};

type PresentationUpdate = Partial<Pick<
  EditorPresentation,
  | "title"
  | "quiz_name"
  | "background_color"
  | "background_image_url"
  | "background_image_asset_id"
  | "background_image_focal_x"
  | "background_image_focal_y"
  | "text_color"
  | "accent_color"
  | "visualization_palette"
  | "music_url"
>> & {
  revision?: number;
  background?: Partial<EditorPresentation["background"]>;
};

const updatePresentation = async (quizID: string, data: PresentationUpdate): Promise<EditorPresentation> => {
  const settings: Record<string, unknown> = {};
  if (data.background_color !== undefined || data.background?.color !== undefined) settings.background_color = data.background_color ?? data.background?.color;
  if (data.background_image_url !== undefined || data.background?.image !== undefined) settings.background_image_url = data.background_image_url ?? data.background?.image;
  if (data.background_image_asset_id !== undefined) settings.background_image_asset_id = data.background_image_asset_id;
  if (data.background_image_focal_x !== undefined || data.background?.focal_x !== undefined) settings.background_image_focal_x = data.background_image_focal_x ?? data.background?.focal_x;
  if (data.background_image_focal_y !== undefined || data.background?.focal_y !== undefined) settings.background_image_focal_y = data.background_image_focal_y ?? data.background?.focal_y;
  if (data.text_color !== undefined || data.background?.text_color !== undefined) settings.text_color = data.text_color ?? data.background?.text_color;
  if (data.accent_color !== undefined) settings.accent_color = data.accent_color;
  if (data.visualization_palette !== undefined) settings.visualization_palette = data.visualization_palette;
  if (data.music_url !== undefined) settings.music_url = data.music_url;
  const json: Record<string, unknown> = {};
  const title = data.title ?? data.quiz_name;
  if (title !== undefined) json.title = title;
  if (Object.keys(settings).length) json.settings = settings;
  if (!Object.keys(json).length) return quizService.getEditorQuiz(quizID);
  const response = await request<PresentationDTO>(`/presentations/${quizID}`, {
    method: "PATCH",
    headers: revisionHeaders(data.revision),
    json,
  });
  return presentationToEditor(response);
};

export const quizService = {
  listPresentations: (options?: RequestOptions) => request<PresentationSummaryDTO[]>("/presentations", options),
  createPresentation: (title = "Untitled Presentation") =>
    request<PresentationDTO>("/presentations", {
      method: "POST",
      json: {
        title,
        settings: {
          background_color: DEFAULT_PRESENTATION_BACKGROUND,
          background_image_url: "",
          background_image_focal_x: 0.5,
          background_image_focal_y: 0.5,
          text_color: DEFAULT_PRESENTATION_FOREGROUND,
          accent_color: DEFAULT_PRESENTATION_ACCENT,
          visualization_palette: [...DEFAULT_VISUALIZATION_PALETTE],
          music_url: "",
        },
      },
    }),
  deletePresentation: (id: string) => request<void>(`/presentations/${id}`, { method: "DELETE" }),
  duplicatePresentation: (id: string, title: string) => request<PresentationDTO>(`/presentations/${id}/duplicate`, { method: "POST", json: { title } }),
  resetPresentationResults: (id: string) => request<void>(`/presentations/${id}/results`, { method: "DELETE" }),

  getQuiz: async (quizID: string, options?: RequestOptions) => presentationToEditor(await request<PresentationDTO>(`/presentations/${quizID}`, options)),
  getEditorQuiz: async (quizID: string, options?: RequestOptions) =>
    presentationToEditor(
      await request<PresentationDTO>(`/presentations/${quizID}`, options),
    ),
  updateQuiz: updatePresentation,
  updateQuizMusic: (quizID: string, musicURL: string, revision?: number) => updatePresentation(quizID, { music_url: musicURL || "", revision }),
  updateQuizBackground: (quizID: string, data: PresentationUpdate, revision?: number) => updatePresentation(quizID, { ...data, revision: revision ?? data.revision }),
  setAccessCode: (quizID: string, accessCode: string) => request<AccessCodeResultDTO>(`/presentations/${quizID}/access-code`, {
    method: "PUT",
    json: { access_code: accessCode },
  }),

  createSlide: async (quizID: string, slide: EditorSlide, presentationRevision?: number) => editorSlideFromTransport(await request<SlideDTO>(`/presentations/${quizID}/slides`, {
    method: "POST",
    headers: revisionHeaders(presentationRevision),
    json: editorSlideToTransportDefinition(slide, slide.order),
  })),
  updateSlide: (quizID: string, slideID: string, slide: EditorSlide) => queueSlideMutation(quizID, slideID, async () =>
    editorSlideFromTransport(await request<SlideDTO>(`/presentations/${quizID}/slides/${slideID}`, {
      method: "PUT",
      headers: revisionHeaders(slide.revision),
      json: editorSlideToTransportDefinition(slide, slide.order),
    }))),
  deleteSlide: (quizID: string, slideID: string, revision?: number) => request<void>(`/presentations/${quizID}/slides/${slideID}`, {
    method: "DELETE",
    headers: revisionHeaders(revision),
  }),
  reorderSlides: (quizID: string, slideIDs: string[], revision?: number) => request<void>(`/presentations/${quizID}/slides/reorder`, {
    method: "POST",
    headers: revisionHeaders(revision),
    json: { slide_ids: slideIDs.map(String) },
  }),

  getSlidesFromAPI: (quizID: string) => quizService.getQuiz(quizID),
};


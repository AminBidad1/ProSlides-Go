import {
  LIVE_CONTENT_LIMITS,
  LIVE_QUESTION_LIMITS,
  LIVE_TEXT_ACTIVITY_LIMITS,
  isOptionalLiveHttpUrl,
  liveTextLength,
  liveTextLineCount,
} from "../../../shared/presentation/liveAuthoringPolicy.ts";
import type { LivePresentationModel } from "./presentation.ts";
import type {
  LegacyContentSlide,
  LegacyLiveSlide,
  LegacyQuestionSlide,
} from "./serverData.ts";

type RoomId = string | number | null | undefined;
type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;
type MutableStorage = Pick<Storage, "removeItem">;

export type PlayerLastActive =
  | {
      kind: "question";
      payload: LegacyQuestionSlide;
      updatedAt: number;
    }
  | {
      kind: "content";
      payload: LegacyContentSlide;
      updatedAt: number;
    };

export const EMPTY_PRESENTATION: LivePresentationModel = {
  quiz_id: "",
  title: "",
  access_code: "",
  background: {
    color: "#1e1e2e",
    image: "",
    text_color: "#111827",
  },
  music_url: "",
  slides: [],
  text_color: "#111827",
};

const playerSeenKey = (roomId: RoomId) =>
  `presentation_player_seen_active_v1:${String(roomId || "unknown")}`;

const playerLastActiveKey = (roomId: RoomId) =>
  `presentation_player_last_active_v2:${String(roomId || "unknown")}`;

const sessionStorageOrNull = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const localStorageOrNull = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isQuestionPayload = (value: unknown): value is LegacyQuestionSlide =>
  isRecord(value) &&
  value.item_kind === "activity" &&
  value.question_id != null;

const isContentPayload = (value: unknown): value is LegacyContentSlide =>
  isRecord(value) &&
  value.item_kind === "content" &&
  (
    String(value.title ?? "").trim().length > 0 ||
    String(value.content_text ?? "").trim().length > 0 ||
    String(value.content_image_url ?? "").trim().length > 0
  );

export const readPlayerSeenActive = (
  roomId: RoomId,
  storage: ReadableStorage | null = sessionStorageOrNull(),
): boolean => {
  try {
    return storage?.getItem(playerSeenKey(roomId)) === "1";
  } catch {
    return false;
  }
};

export const persistPlayerSeenActive = (
  roomId: RoomId,
  storage: WritableStorage | null = sessionStorageOrNull(),
): void => {
  try {
    storage?.setItem(playerSeenKey(roomId), "1");
  } catch {
    // Storage is a best-effort resume optimization.
  }
};

export const clearPlayerSeenActive = (
  roomId: RoomId,
  storage: MutableStorage | null = sessionStorageOrNull(),
): void => {
  try {
    storage?.removeItem(playerSeenKey(roomId));
  } catch {
    // Storage is a best-effort resume optimization.
  }
};

export const readPlayerLastActive = (
  roomId: RoomId,
  storage: ReadableStorage | null = localStorageOrNull(),
): PlayerLastActive | null => {
  try {
    const raw = storage?.getItem(playerLastActiveKey(roomId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.kind !== "string") return null;
    const updatedAt = Number(parsed.updatedAt);
    if (!Number.isFinite(updatedAt)) return null;

    if (parsed.kind === "question" && isQuestionPayload(parsed.payload)) {
      return {
        kind: "question",
        payload: parsed.payload,
        updatedAt,
      };
    }

    if (parsed.kind === "content" && isContentPayload(parsed.payload)) {
      return {
        kind: "content",
        payload: parsed.payload,
        updatedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const persistPlayerLastActive = (
  roomId: RoomId,
  active: PlayerLastActive,
  storage: WritableStorage | null = localStorageOrNull(),
): void => {
  try {
    storage?.setItem(playerLastActiveKey(roomId), JSON.stringify(active));
  } catch {
    // Storage is a best-effort resume optimization.
  }
};

export const isQuestionSlide = (
  slide: unknown,
): slide is LegacyQuestionSlide =>
  isRecord(slide) &&
  slide.item_kind === "activity";

export type LiveActivityStartIssue =
  | "choice_prompt_required"
  | "choice_prompt_invalid"
  | "choice_options_too_few"
  | "choice_options_too_many"
  | "choice_option_invalid"
  | "choice_correct_answer_invalid"
  | "activity_timing_invalid"
  | "activity_media_invalid"
  | "text_prompt_required"
  | "text_prompt_invalid"
  | "text_response_invalid"
  | "content_required"
  | "content_density_invalid"
  | "content_media_invalid";

export const getLiveActivityStartIssue = (
  slide: unknown,
): LiveActivityStartIssue | null => {
  if (!isRecord(slide)) return null;

  if (slide.item_kind === "content") {
    const title = String(slide.title ?? "");
    const text = String(slide.content_text ?? "");
    const imageUrl = String(slide.content_image_url ?? "");

    if (!title.trim() && !text.trim() && !imageUrl.trim()) {
      return "content_required";
    }
    if (
      liveTextLength(title) > LIVE_CONTENT_LIMITS.title ||
      liveTextLineCount(title) > LIVE_CONTENT_LIMITS.titleMaxLines ||
      liveTextLength(text) > LIVE_CONTENT_LIMITS.text ||
      liveTextLineCount(text) > LIVE_CONTENT_LIMITS.maxLines
    ) {
      return "content_density_invalid";
    }
    if (
      liveTextLength(imageUrl) > LIVE_CONTENT_LIMITS.imageUrl ||
      !isOptionalLiveHttpUrl(imageUrl)
    ) {
      return "content_media_invalid";
    }
    return null;
  }

  if (!isQuestionSlide(slide)) return null;

  const prompt = String(slide.question_text ?? "").trim();
  const title = String(slide.question_title ?? "");
  const imageUrl = String(slide.image_url ?? "");
  const duration = Number(slide.question_time);
  const timingInvalid =
    !Number.isInteger(duration) ||
    duration < LIVE_QUESTION_LIMITS.minDurationSeconds ||
    duration > LIVE_QUESTION_LIMITS.maxDurationSeconds;
  const mediaInvalid =
    liveTextLength(imageUrl) > LIVE_QUESTION_LIMITS.imageUrl ||
    !isOptionalLiveHttpUrl(imageUrl);

  if (slide.activity_kind === "text") {
    if (!prompt) return "text_prompt_required";
    if (
      liveTextLength(prompt) > LIVE_TEXT_ACTIVITY_LIMITS.promptText ||
      liveTextLineCount(prompt) > LIVE_TEXT_ACTIVITY_LIMITS.promptMaxLines ||
      liveTextLength(title) > LIVE_TEXT_ACTIVITY_LIMITS.title ||
      liveTextLineCount(title) > LIVE_TEXT_ACTIVITY_LIMITS.titleMaxLines
    ) {
      return "text_prompt_invalid";
    }
    if (timingInvalid) return "activity_timing_invalid";
    if (mediaInvalid) return "activity_media_invalid";

    const entryBased = slide.response_aggregation === "entry_frequency";
    const responseLength = Number(
      entryBased
        ? slide.response_max_entry_length
        : slide.response_max_length,
    );
    const responseWords = Number(
      entryBased
        ? slide.response_max_entries
        : slide.response_max_words,
    );
    if (
      !Number.isInteger(responseLength) ||
      responseLength < LIVE_TEXT_ACTIVITY_LIMITS.minResponseLength ||
      responseLength > LIVE_TEXT_ACTIVITY_LIMITS.maxResponseLength ||
      !Number.isInteger(responseWords) ||
      responseWords < LIVE_TEXT_ACTIVITY_LIMITS.minWords ||
      responseWords > LIVE_TEXT_ACTIVITY_LIMITS.maxWords
    ) {
      return "text_response_invalid";
    }
    return null;
  }

  if (!prompt) return "choice_prompt_required";
  if (
    liveTextLength(prompt) > LIVE_QUESTION_LIMITS.text ||
    liveTextLineCount(prompt) > LIVE_QUESTION_LIMITS.maxLines ||
    liveTextLength(title) > LIVE_QUESTION_LIMITS.title ||
    liveTextLineCount(title) > LIVE_QUESTION_LIMITS.titleMaxLines
  ) {
    return "choice_prompt_invalid";
  }
  if (timingInvalid) return "activity_timing_invalid";
  if (mediaInvalid) return "activity_media_invalid";

  const options = Array.isArray(slide.options) ? slide.options : [];
  if (options.length < LIVE_QUESTION_LIMITS.minOptions) {
    return "choice_options_too_few";
  }
  const requiresCorrectness = slide.has_correct_answer !== false;
  const maxOptions = requiresCorrectness
    ? LIVE_QUESTION_LIMITS.maxQuizOptions
    : LIVE_QUESTION_LIMITS.maxPollOptions;
  if (options.length > maxOptions) {
    return "choice_options_too_many";
  }

  const optionIds = new Set<string>();
  for (const option of options) {
    const id = String(option.option_id ?? "").trim();
    const optionText = String(option.option_text ?? "").trim();
    const optionImage = String(option.image_url ?? "");
    if (
      !id ||
      optionIds.has(id) ||
      !optionText ||
      liveTextLength(optionText) > LIVE_QUESTION_LIMITS.optionText ||
      liveTextLineCount(optionText) > LIVE_QUESTION_LIMITS.optionMaxLines ||
      liveTextLength(optionImage) > LIVE_QUESTION_LIMITS.imageUrl ||
      !isOptionalLiveHttpUrl(optionImage)
    ) {
      return "choice_option_invalid";
    }
    optionIds.add(id);
  }

  if (!requiresCorrectness) return null;

  const correct = options.filter((option) => option.answer === true).length;
  if (
    correct < 1 ||
    (slide.question_type === "single" && correct !== 1)
  ) {
    return "choice_correct_answer_invalid";
  }

  return null;
};

export const findLiveActivityStartIssue = (
  slides: Array<LegacyLiveSlide | null>,
): LiveActivityStartIssue | null => {
  for (const slide of slides) {
    const issue = getLiveActivityStartIssue(slide);
    if (issue) return issue;
  }
  return null;
};

const hasContentPayload = (slide: unknown): boolean =>
  isRecord(slide) &&
  (
    String(slide.title ?? "").trim().length > 0 ||
    String(slide.content_text ?? "").trim().length > 0 ||
    String(slide.content_image_url ?? "").trim().length > 0
  );

export const isContentSlide = (
  slide: unknown,
): slide is LegacyContentSlide =>
  isRecord(slide) &&
  slide.item_kind === "content" &&
  hasContentPayload(slide);

type PresentationSlide = LegacyLiveSlide | null;

export type ManagerPresentationView =
  | "ManagerJoinPage"
  | "ManagerPickAnswerQuestion"
  | "ManagerLeaderBoard"
  | "ManagerContentSlide"
  | "ManagerFinalLeaderboard";

export const findQuestionSlideIndex = (
  slides: PresentationSlide[],
  questionId: string | number | null | undefined,
): number => {
  if (questionId == null) return -1;

  return slides.findIndex(
    (slide) =>
      isQuestionSlide(slide) &&
      String(slide.question_id ?? slide.question?.question_id ?? "") ===
        String(questionId),
  );
};

export const findContentSlideIndex = (
  slides: PresentationSlide[],
  content: LegacyContentSlide,
): number => {
  const incomingOrder =
    content.order ?? content.slide_order ?? content.slideOrder ?? null;

  return slides.findIndex(
    (slide) =>
      isContentSlide(slide) &&
      (
        slide.slide_id === content.slide_id ||
        (incomingOrder != null && slide.order === incomingOrder)
      ),
  );
};

export const findSlideIndexById = (
  slides: PresentationSlide[],
  slideId: string | number | null | undefined,
): number => {
  if (slideId == null) return -1;

  return slides.findIndex(
    (slide) =>
      slide != null &&
      String(slide.slide_id ?? "") === String(slideId),
  );
};

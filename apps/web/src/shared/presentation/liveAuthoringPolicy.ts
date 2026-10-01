export const LIVE_QUESTION_LIMITS = {
  title: 80,
  titleMaxLines: 1,
  text: 180,
  maxLines: 4,
  optionText: 75,
  optionMaxLines: 2,
  optionId: 128,
  imageUrl: 4_096,
  minOptions: 2,
  maxQuizOptions: 8,
  maxPollOptions: 12,
  minDurationSeconds: 5,
  maxDurationSeconds: 1_200,
} as const;

export const LIVE_TEXT_ACTIVITY_LIMITS = {
  title: 80,
  titleMaxLines: 1,
  promptText: 180,
  promptMaxLines: 4,
  imageUrl: 4_096,
  minResponseLength: 1,
  maxResponseLength: 40,
  minWords: 1,
  maxWords: 5,
  minDurationSeconds: 5,
  maxDurationSeconds: 1_200,
} as const;

export const LIVE_CONTENT_LIMITS = {
  title: 120,
  titleMaxLines: 2,
  text: 600,
  maxLines: 10,
  imageUrl: 4_096,
} as const;

export const liveTextLength = (value: unknown): number =>
  Array.from(String(value ?? "")).length;

export const liveTextLineCount = (value: unknown): number => {
  const normalized = String(value ?? "")
    .replace(/\r\n/gu, "\n")
    .replace(/\r/gu, "\n");
  return normalized.split("\n").length;
};


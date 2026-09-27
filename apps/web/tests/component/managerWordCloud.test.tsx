import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyQuestionSlide } from "../../src/modules/live/model/serverData.ts";
import { ManagerPickAnswerQuestion } from "../../src/modules/live/manager/ui/ManagerPickAnswerQuestion.tsx";
import {
  LiveSessionContext,
  type LiveSessionContextValue,
} from "../../src/modules/live/react/liveSessionContext.ts";
import { AudioProvider } from "../../src/modules/live/react/AudioProvider.tsx";
import { ServerDataProvider } from "../../src/modules/live/react/ServerDataProvider.tsx";

const question: LegacyQuestionSlide = {
  item_kind: "activity",
  slide_id: "cloud-1",
  question_id: "cloud-1",
  run_id: 4,
  activity_kind: "text",
  question_text: "جلسه را با چند واژه توصیف کنید",
  question_time: 60,
  remaining_seconds: 0,
  response_max_length: 80,
  response_max_words: 3,
  show_leaderboard_after: false,
  is_scored: false,
  has_correct_answer: false,
};

const quiz: LivePresentationModel = {
  quiz_id: "presentation-1",
  title: "ارائه آزمایشی",
  access_code: "ROOM1",
  background: {
    color: "#1e1e2e",
    image: "",
    text_color: "#ffffff",
  },
  music_url: "",
  slides: [
    {
      item_kind: "activity",
      slide_id: "choice-1",
      question_id: "choice-1",
      activity_kind: "choice",
      question_text: "سؤال قبلی",
      question_type: "single",
      has_correct_answer: true,
      options: [
        { option_id: 0, option_text: "الف", answer: true },
        { option_id: 1, option_text: "ب", answer: false },
      ],
    },
    {
      item_kind: "content",
      slide_id: "content-1",
      title: "اسلاید محتوایی",
      content_text: "",
      content_image_url: "",
    },
    question,
  ],
  text_color: "#ffffff",
};

const snapshot: LiveSnapshot = {
  role: "manager",
  presentation: {
    title: "ارائه آزمایشی",
    background_color: "#1e1e2e",
    background_image_url: "",
    music_url: "",
    text_color: "#ffffff",
  },
  session: {
    id: "session-1",
    presentation_id: "presentation-1",
    host_id: "manager-1",
    join_code: "ROOM1",
    state: "presenting",
    state_version: 4,
    active_item_id: "cloud-1",
    activity_phase: "revealed",
    stage_view: "item",
    ends_at: null,
    remaining_seconds: null,
  },
  active_item: {
    id: "cloud-1",
    position: 0,
    kind: "activity",
    content: {
      schema_version: 1,
      activity_kind: "text",
      prompt: {
        title: "",
        text: "جلسه را با چند واژه توصیف کنید",
        image_url: "",
      },
      response: {
        max_length: 80,
        max_words: 3,
      },
      evaluation: { mode: "none" },
      scoring: { mode: "none" },
      timing: { duration_seconds: 60 },
      results: {
        aggregation: "word_frequency",
        show_overall_leaderboard_after: false,
      },
    },
  },
  participant_count: 3,
  has_scoring: false,
  last_event_id: 8,
  activity_result: {
    activity_item_id: "cloud-1",
    activity_kind: "text",
    schema_version: 1,
    response_count: 3,
    payload: {
      terms: [
        { text: "خلاق", count: 3 },
        { text: "سریع", count: 2 },
      ],
    },
  },
  activity_top_performers: [],
};

const context: LiveSessionContextValue = {
  isConnected: true,
  isStreamConnected: true,
  connectionError: null,
  sessionId: "session-1",
  snapshot,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "joined",
  hasMoreRoster: false,
  isRosterLoading: false,
  participantCount: 3,
  connect: vi.fn(async () => true),
  disconnect: vi.fn(),
  joinParticipant: vi.fn(async () => true),
  submitAnswer: vi.fn(async () => true),
  sendNavigation: vi.fn(async () => true),
  sendManagerAction: vi.fn(async () => true),
  sendEnd: vi.fn(async () => true),
  loadRoster: vi.fn(async () => true),
  loadMoreRoster: vi.fn(async () => true),
};

test("manager primary surface renders revealed Word Cloud terms", async () => {
  render(
    <MemoryRouter>
      <AudioProvider>
        <LiveSessionContext.Provider value={context}>
          <ServerDataProvider>
            <ManagerPickAnswerQuestion
              roomId="presentation-1"
              currentSlide={2}
              totalSlides={3}
              quiz={quiz}
              isRemoteReady
              onNext={vi.fn()}
              onEndGame={vi.fn()}
            />
          </ServerDataProvider>
        </LiveSessionContext.Provider>
      </AudioProvider>
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole("heading", {
      name: "جلسه را با چند واژه توصیف کنید",
    }),
  ).not.toBeNull();
  expect(
    screen.queryByText("در حال آماده‌سازی سؤال…"),
  ).toBeNull();
  expect(screen.getByText("سؤال ۳ از ۳")).not.toBeNull();
  expect(screen.getByLabelText("نتیجه ابر واژه")).not.toBeNull();
  expect(screen.getByText("۳ پاسخ ثبت‌شده")).not.toBeNull();
  expect(screen.getByText("خلاق")).not.toBeNull();
  expect(screen.getByText("سریع")).not.toBeNull();
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyQuestionSlide } from "../../src/modules/live/model/serverData.ts";
import { ManagerPickAnswerQuestion } from "../../src/modules/live/manager/ui/ManagerPickAnswerQuestion.tsx";
import { ManagerBackstageDrawer } from "../../src/modules/live/manager/ui/ManagerBackstageDrawer.tsx";
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
  word_cloud_moderation: {
    activity_item_id: "cloud-1",
    terms: [
      {
        canonical_key: "خلاق",
        text: "خلاق",
        count: 3,
        hidden: false,
      },
      {
        canonical_key: "سریع",
        text: "سریع",
        count: 2,
        hidden: false,
      },
    ],
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
  resync: vi.fn(async () => true),
  joinParticipant: vi.fn(async () => true),
  submitAnswer: vi.fn(async () => true),
  sendNavigation: vi.fn(async () => true),
  sendManagerAction: vi.fn(async () => true),
  moderateWordCloudTerm: vi.fn(async () => true),
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
              sessionId="session-1"
              currentSlide={2}
              totalSlides={3}
              quiz={quiz}
              isRemoteReady
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
  expect(await screen.findByLabelText("نتیجه ابر واژه")).not.toBeNull();
  expect(screen.getByText("۳ پاسخ ثبت‌شده")).not.toBeNull();
  expect(await screen.findByText("خلاق")).not.toBeNull();
  expect(screen.getByText("سریع")).not.toBeNull();
});


test("private Backstage does not disclose results before presenter confirmation", async () => {
  render(
    <MemoryRouter
      initialEntries={[
        "/manager/presentation/presentation-1?backstage=1",
      ]}
    >
      <AudioProvider>
        <LiveSessionContext.Provider value={context}>
          <ServerDataProvider>
            <ManagerBackstageDrawer quiz={quiz} currentSlide={3} />
          </ServerDataProvider>
        </LiveSessionContext.Provider>
      </AudioProvider>
    </MemoryRouter>,
  );

  expect(
    screen.getByRole("heading", {
      name: "پیش از نمایش اطلاعات پشت‌صحنه",
    }),
  ).not.toBeNull();
  expect(screen.queryByText("خلاق")).toBeNull();
  expect(screen.queryByLabelText("پیش‌نمایش خصوصی ابر واژه")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "نمایش پشت‌صحنه خصوصی" }),
  );

  expect(
    await screen.findByRole("heading", { name: "پشت‌صحنه" }),
  ).not.toBeNull();
  expect(
    await screen.findByLabelText("پیش‌نمایش خصوصی ابر واژه"),
  ).not.toBeNull();
  expect((await screen.findAllByText("خلاق")).length).toBeGreaterThan(0);
  expect(
    screen.getByRole("heading", { name: "مدیریت واژه‌های ابر" }),
  ).not.toBeNull();

  const moderationSearch = screen.getByRole("searchbox", {
    name: "جست‌وجوی واژه برای مدیریت",
  });
  const moderationList = screen.getByLabelText("فهرست مدیریت واژه‌های ابر");
  fireEvent.change(moderationSearch, { target: { value: "سريع" } });
  expect(within(moderationList).getByText("سریع")).not.toBeNull();
  expect(within(moderationList).queryByText("خلاق")).toBeNull();
  fireEvent.change(moderationSearch, { target: { value: "" } });

  fireEvent.click(
    screen.getByRole("button", { name: "پنهان کردن خلاق" }),
  );
  expect(context.moderateWordCloudTerm).toHaveBeenCalledWith("خلاق", true);

  fireEvent.click(
    screen.getByRole("button", { name: "پوشاندن اطلاعات" }),
  );
  expect(
    screen.getByRole("heading", {
      name: "پیش از نمایش اطلاعات پشت‌صحنه",
    }),
  ).not.toBeNull();
  expect(screen.queryByText("خلاق")).toBeNull();
});

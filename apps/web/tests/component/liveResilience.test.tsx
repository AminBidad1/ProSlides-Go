import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyQuestionSlide } from "../../src/modules/live/model/serverData.ts";
import { ManagerControls } from "../../src/modules/live/manager/ui/ManagerControls.tsx";
import { ManagerJoinPage } from "../../src/modules/live/manager/ui/ManagerJoinPage.tsx";
import { ParticipantWordCloud } from "../../src/modules/live/participant/ui/ParticipantWordCloud.tsx";
import { AudioProvider } from "../../src/modules/live/react/AudioProvider.tsx";
import { LiveSessionContext, type LiveSessionContextValue } from "../../src/modules/live/react/liveSessionContext.ts";
import { ServerDataProvider } from "../../src/modules/live/react/ServerDataProvider.tsx";
import { useServerData } from "../../src/modules/live/react/useServerData.ts";

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
  slides: [],
  text_color: "#ffffff",
};

const baseContext = (
  overrides: Partial<LiveSessionContextValue> = {},
): LiveSessionContextValue => ({
  isConnected: true,
  isStreamConnected: true,
  connectionError: null,
  sessionId: "session-a",
  snapshot: null,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "joined",
  hasMoreRoster: false,
  isRosterLoading: false,
  participantCount: 0,
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
  ...overrides,
});

const managerSnapshot = (
  id: string,
  stageView: "item" | "overall_ranking",
): LiveSnapshot =>
  ({
    role: "manager",
    presentation: {
      title: "ارائه آزمایشی",
      background_color: "#1e1e2e",
      background_image_url: "",
      music_url: "",
      text_color: "#ffffff",
      accent_color: "#8b5cf6",
      visualization_palette: ["#8b5cf6", "#06b6d4", "#10b981"],
    },
    session: {
      id,
      presentation_id: "presentation-1",
      host_id: "manager-1",
      join_code: "ROOM1",
      state: "presenting",
      state_version: 3,
      active_item_id: null,
      activity_phase: null,
      stage_view: stageView,
      ends_at: null,
      remaining_seconds: null,
    },
    participant_count: 1,
    has_scoring: true,
    last_event_id: 3,
    activity_top_performers: [],
  }) as LiveSnapshot;

function LeaderboardProbe() {
  const { managerLastLeaderboard } = useServerData();
  return (
    <output data-testid="manager-last-leaderboard">
      {managerLastLeaderboard?.map((row) => row.name).join(",") ?? "none"}
    </output>
  );
}

describe("live React lifecycle resilience", () => {
  test("presenter primary control ignores duplicate clicks while a live command is pending", async () => {
    let release: (() => void) | null = null;
    const onNext = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(
      <ManagerControls
        currentSlide={1}
        totalSlides={2}
        onNext={onNext}
        onEnd={vi.fn()}
      />,
    );

    const next = screen.getByRole("button", { name: "آیتم بعدی" });
    fireEvent.click(next);
    fireEvent.click(next);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(next.textContent).toContain("در حال اعمال…");

    await act(async () => {
      release?.();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );
  });


  test("lobby start ignores duplicate clicks while the start command is pending", async () => {
    let release: (() => void) | null = null;
    const sendNavigation = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = () => resolve(true);
        }),
    );
    const lobbySnapshot = {
      ...managerSnapshot("session-a", "item"),
      session: {
        ...managerSnapshot("session-a", "item").session,
        state: "lobby" as const,
        state_version: 2,
      },
    } as LiveSnapshot;
    const lobbyQuiz: LivePresentationModel = {
      ...quiz,
      slides: [
        {
          item_kind: "content",
          slide_id: "intro",
          order: 0,
          title: "مقدمه",
          content_text: "شروع ارائه",
          content_image_url: "",
        },
      ],
    };

    render(
      <MemoryRouter>
        <AudioProvider>
          <LiveSessionContext.Provider
            value={baseContext({
              snapshot: lobbySnapshot,
              sendNavigation,
            })}
          >
            <ServerDataProvider>
              <ManagerJoinPage quiz={lobbyQuiz} />
            </ServerDataProvider>
          </LiveSessionContext.Provider>
        </AudioProvider>
      </MemoryRouter>,
    );

    const start = screen.getByRole("button", { name: "شروع ارائه" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(sendNavigation).toHaveBeenCalledTimes(1);
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(start.textContent).toContain("در حال شروع…");

    await act(async () => {
      release?.();
      await Promise.resolve();
    });

    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  });

  test("cached manager leaderboard never leaks into a different Session", async () => {
    const sessionA = baseContext({
      sessionId: "session-a",
      snapshot: managerSnapshot("session-a", "overall_ranking"),
      roster: [
        {
          participant_id: "participant-a",
          display_name: "بازیکن جلسه الف",
          avatar: "🙂",
          score: 100,
          rank: 1,
          joined_at: "2026-09-27T10:00:00Z",
        },
      ],
      rosterOrder: "score",
      participantCount: 1,
    });

    const sessionB = baseContext({
      sessionId: "session-b",
      snapshot: managerSnapshot("session-b", "item"),
      roster: [
        {
          participant_id: "participant-b",
          display_name: "بازیکن جلسه ب",
          avatar: "🙂",
          score: 0,
          rank: null,
          joined_at: "2026-09-27T11:00:00Z",
        },
      ],
      rosterOrder: "joined",
      participantCount: 1,
    });

    const view = render(
      <LiveSessionContext.Provider value={sessionA}>
        <ServerDataProvider>
          <LeaderboardProbe />
        </ServerDataProvider>
      </LiveSessionContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("manager-last-leaderboard").textContent).toBe(
        "بازیکن جلسه الف",
      );
    });

    view.rerender(
      <LiveSessionContext.Provider value={sessionB}>
        <ServerDataProvider>
          <LeaderboardProbe />
        </ServerDataProvider>
      </LiveSessionContext.Provider>,
    );

    expect(screen.getByTestId("manager-last-leaderboard").textContent).toBe(
      "none",
    );
  });

  test("cached manager ranking survives the transient empty roster at Session end", async () => {
    const rankingContext = baseContext({
      sessionId: "session-a",
      snapshot: managerSnapshot("session-a", "overall_ranking"),
      roster: [
        {
          participant_id: "participant-a",
          display_name: "بازیکن اول",
          avatar: "🙂",
          score: 100,
          rank: 1,
          joined_at: "2026-09-27T10:00:00Z",
        },
      ],
      rosterOrder: "score",
      participantCount: 1,
    });

    const endedSnapshot = {
      ...managerSnapshot("session-a", "item"),
      session: {
        ...managerSnapshot("session-a", "item").session,
        state: "ended" as const,
        state_version: 4,
      },
    } as LiveSnapshot;
    const endedContext = baseContext({
      sessionId: "session-a",
      snapshot: endedSnapshot,
      roster: [],
      rosterOrder: "score",
      participantCount: 1,
    });

    const view = render(
      <LiveSessionContext.Provider value={rankingContext}>
        <ServerDataProvider>
          <LeaderboardProbe />
        </ServerDataProvider>
      </LiveSessionContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("manager-last-leaderboard").textContent).toBe(
        "بازیکن اول",
      );
    });

    view.rerender(
      <LiveSessionContext.Provider value={endedContext}>
        <ServerDataProvider>
          <LeaderboardProbe />
        </ServerDataProvider>
      </LiveSessionContext.Provider>,
    );

    expect(screen.getByTestId("manager-last-leaderboard").textContent).toBe(
      "بازیکن اول",
    );
  });

  test("entry Word Cloud submits phrases as independent entries", async () => {
    const submitAnswer = vi.fn(async () => true);
    const question: LegacyQuestionSlide = {
      item_kind: "activity",
      slide_id: "cloud-entry",
      question_id: "cloud-entry",
      run_id: 7,
      activity_kind: "text",
      question_title: "نظر جمع",
      question_text: "دو عبارت کوتاه بنویسید",
      image_url: "https://example.test/cloud.png",
      question_time: 60,
      remaining_seconds: 60,
      response_aggregation: "entry_frequency",
      response_max_entry_length: 30,
      response_max_entries: 3,
    };

    render(
      <LiveSessionContext.Provider value={baseContext({ submitAnswer })}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    expect(await screen.findByText("نظر جمع")).not.toBeNull();
    expect(
      document.querySelector('img[src="https://example.test/cloud.png"]'),
    ).not.toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "عبارت ۱" }), {
      target: { value: "هوش مصنوعی" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "عبارت ۲" }), {
      target: { value: "کار تیمی" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت پاسخ" }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_item_id: "cloud-entry",
        response: {
          entries: ["هوش مصنوعی", "کار تیمی"],
        },
      }),
    );
  });

  test("submitted Word Cloud answer does not claim local-only preservation during stream recovery", async () => {
    const submitAnswer = vi.fn(async () => true);
    const question: LegacyQuestionSlide = {
      item_kind: "activity",
      slide_id: "cloud-sent-recovery",
      question_id: "cloud-sent-recovery",
      run_id: 10,
      activity_kind: "text",
      question_text: "ابر ثبت‌شده",
      question_time: 60,
      remaining_seconds: 60,
      response_aggregation: "entry_frequency",
      response_max_entry_length: 30,
      response_max_entries: 3,
    };
    const connected = baseContext({
      submitAnswer,
      isConnected: true,
      isStreamConnected: true,
    });
    const disconnected = baseContext({
      submitAnswer,
      isConnected: true,
      isStreamConnected: false,
      connectionError: "event_stream_stalled",
    });

    const view = render(
      <LiveSessionContext.Provider value={connected}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "عبارت ۱" }), {
      target: { value: "هوش مصنوعی" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت پاسخ" }));
    await screen.findByText("پاسخ ثبت شد ✓");

    view.rerender(
      <LiveSessionContext.Provider value={disconnected}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    expect(
      screen.getByText("پاسخ شما ثبت شده است؛ ارتباط زنده در حال بازیابی است."),
    ).not.toBeNull();
    expect(
      screen.queryByText(/پاسخ شما روی این دستگاه حفظ شده است/),
    ).toBeNull();
  });

  test("pending Word Cloud answer retries when the live stream recovers", async () => {
    const submitAnswer = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const question: LegacyQuestionSlide = {
      item_kind: "activity",
      slide_id: "cloud-recovery",
      question_id: "cloud-recovery",
      run_id: 8,
      activity_kind: "text",
      question_text: "ابر بازیابی",
      question_time: 60,
      remaining_seconds: 60,
      response_max_length: 80,
      response_max_words: 3,
    };
    const snapshot = {
      role: "participant",
      session: {
        id: "session-a",
        presentation_id: "presentation-1",
        state: "presenting",
        state_version: 8,
        active_item_id: "cloud-recovery",
        activity_phase: "accepting",
        stage_view: "item",
        ends_at: new Date(Date.now() + 60_000).toISOString(),
        remaining_seconds: 60,
      },
      participant: {
        id: "participant-a",
        display_name: "بازیکن",
        avatar: "🙂",
        score: 0,
      },
      participant_count: 1,
      has_responded: false,
      last_event_id: 8,
    } as LiveSnapshot;

    const connected = baseContext({
      snapshot,
      submitAnswer,
      isStreamConnected: true,
    });
    const disconnected = baseContext({
      snapshot,
      submitAnswer,
      isConnected: true,
      isStreamConnected: false,
      connectionError: "event_stream_stalled",
    });

    const view = render(
      <LiveSessionContext.Provider value={connected}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    const input = await screen.findByRole("textbox", {
      name: "پاسخ متنی شما",
    });
    fireEvent.change(input, { target: { value: "بازیابی" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت پاسخ" }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: /تلاش دوباره/ });

    view.rerender(
      <LiveSessionContext.Provider value={disconnected}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );
    view.rerender(
      <LiveSessionContext.Provider value={connected}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(2));
  });

  test("pending Word Cloud answer retries when browser network returns even if SSE never closed", async () => {
    const submitAnswer = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const question: LegacyQuestionSlide = {
      item_kind: "activity",
      slide_id: "cloud-online",
      question_id: "cloud-online",
      run_id: 9,
      activity_kind: "text",
      question_text: "ابر آنلاین",
      question_time: 60,
      remaining_seconds: 60,
      response_max_length: 80,
      response_max_words: 3,
    };
    const snapshot = {
      role: "participant",
      session: {
        id: "session-a",
        presentation_id: "presentation-1",
        state: "presenting",
        state_version: 9,
        active_item_id: "cloud-online",
        activity_phase: "accepting",
        stage_view: "item",
        ends_at: new Date(Date.now() + 60_000).toISOString(),
        remaining_seconds: 60,
      },
      participant: {
        id: "participant-a",
        display_name: "بازیکن",
        avatar: "🙂",
        score: 0,
      },
      participant_count: 1,
      has_responded: false,
      last_event_id: 9,
    } as LiveSnapshot;
    const context = baseContext({
      snapshot,
      submitAnswer,
      isConnected: true,
      isStreamConnected: true,
    });

    render(
      <LiveSessionContext.Provider value={context}>
        <ParticipantWordCloud
          roomId="session-a"
          question={question}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    const input = await screen.findByRole("textbox", {
      name: "پاسخ متنی شما",
    });
    fireEvent.change(input, { target: { value: "بازگشت شبکه" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت پاسخ" }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: /تلاش دوباره/ });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(2));
  });

  test("late Word Cloud response cannot mutate the next Activity", async () => {
    let resolveFirst: ((value: true) => void) | null = null;
    const submitAnswer = vi.fn(
      () =>
        new Promise<true>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const context = baseContext({ submitAnswer });

    const firstQuestion: LegacyQuestionSlide = {
      item_kind: "activity",
      slide_id: "cloud-a",
      question_id: "cloud-a",
      run_id: 4,
      activity_kind: "text",
      question_text: "ابر اول",
      question_time: 60,
      remaining_seconds: 60,
      response_max_length: 80,
      response_max_words: 3,
    };
    const secondQuestion: LegacyQuestionSlide = {
      ...firstQuestion,
      slide_id: "cloud-b",
      question_id: "cloud-b",
      run_id: 5,
      question_text: "ابر دوم",
    };

    const view = render(
      <LiveSessionContext.Provider value={context}>
        <ParticipantWordCloud
          roomId="session-a"
          question={firstQuestion}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    const firstInput = await screen.findByRole("textbox", {
      name: "پاسخ متنی شما",
    });
    await waitFor(() =>
      expect((firstInput as HTMLTextAreaElement).disabled).toBe(false),
    );
    fireEvent.change(firstInput, { target: { value: "واژه اول" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت پاسخ" }));

    expect(submitAnswer).toHaveBeenCalledTimes(1);
    expect(screen.getByText("در حال ارسال پاسخ…")).not.toBeNull();

    view.rerender(
      <LiveSessionContext.Provider value={context}>
        <ParticipantWordCloud
          roomId="session-a"
          question={secondQuestion}
          quiz={quiz}
        />
      </LiveSessionContext.Provider>,
    );

    expect(await screen.findByText("ابر دوم")).not.toBeNull();

    await act(async () => {
      resolveFirst?.(true);
      await Promise.resolve();
    });

    expect(screen.queryByText("پاسخ ثبت شد ✓")).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: "پاسخ متنی شما" }) as HTMLTextAreaElement)
        .value,
    ).toBe("");
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyQuestionSlide } from "../../src/modules/live/model/serverData.ts";
import { ParticipantWordCloud } from "../../src/modules/live/participant/ui/ParticipantWordCloud.tsx";
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
  joinParticipant: vi.fn(async () => true),
  submitAnswer: vi.fn(async () => true),
  sendNavigation: vi.fn(async () => true),
  sendManagerAction: vi.fn(async () => true),
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

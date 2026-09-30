import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyLiveUser } from "../../src/modules/live/model/serverData.ts";
import { ManagerFinalLeaderboard } from "../../src/modules/live/manager/ui/ManagerFinalLeaderboard.tsx";
import {
  LiveSessionContext,
  type LiveSessionContextValue,
} from "../../src/modules/live/react/liveSessionContext.ts";

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

const endedSnapshot: LiveSnapshot = {
  role: "manager",
  presentation: {
    title: "ارائه آزمایشی",
    background_color: "#1e1e2e",
    background_image_url: "",
    background_image_focal_x: 0.5,
    background_image_focal_y: 0.5,
    music_url: "",
    text_color: "#ffffff",
    accent_color: "#8b5cf6",
    visualization_palette: ["#8b5cf6", "#06b6d4", "#10b981"],
  },
  session: {
    id: "session-1",
    presentation_id: "presentation-1",
    host_id: "manager-1",
    join_code: "ROOM1",
    state: "ended",
    state_version: 8,
    active_item_id: null,
    activity_phase: null,
    stage_view: "item",
    ends_at: null,
    remaining_seconds: null,
  },
  participant_count: 3,
  has_scoring: true,
  last_event_id: 12,
  activity_top_performers: [],
};

const context = (
  overrides: Partial<LiveSessionContextValue> = {},
): LiveSessionContextValue => ({
  isConnected: true,
  isStreamConnected: true,
  connectionError: null,
  sessionId: "session-1",
  snapshot: endedSnapshot,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "score",
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
  ...overrides,
});

test("final manager podium preserves backend competition ranks for ties", () => {
  const rows: LegacyLiveUser[] = [
    {
      user_id: "a",
      name: "الف",
      character: "🙂",
      rank: 1,
      total_points: 100,
      new_points: null,
    },
    {
      user_id: "b",
      name: "ب",
      character: "🙂",
      rank: 1,
      total_points: 100,
      new_points: null,
    },
    {
      user_id: "c",
      name: "ج",
      character: "🙂",
      rank: 3,
      total_points: 80,
      new_points: null,
    },
  ];

  render(
    <LiveSessionContext.Provider value={context()}>
      <ManagerFinalLeaderboard
        leaderboardData={rows}
        quiz={quiz}
        onExit={vi.fn()}
      />
    </LiveSessionContext.Provider>,
  );

  expect(screen.getAllByLabelText("رتبه ۱")).toHaveLength(2);
  expect(screen.getByLabelText("رتبه ۳")).not.toBeNull();
});

test("final manager surface reports SSE recovery and retries an empty ranking once", async () => {
  const loadRoster = vi.fn(async () => true);

  render(
    <LiveSessionContext.Provider
      value={context({
        isConnected: true,
        isStreamConnected: false,
        loadRoster,
      })}
    >
      <ManagerFinalLeaderboard
        leaderboardData={[]}
        quiz={quiz}
        onExit={vi.fn()}
      />
    </LiveSessionContext.Provider>,
  );

  expect(screen.getByRole("status").textContent).toContain("در حال اتصال");
  await waitFor(() => {
    expect(loadRoster).toHaveBeenCalledTimes(1);
    expect(loadRoster).toHaveBeenCalledWith("score", false);
  });
});

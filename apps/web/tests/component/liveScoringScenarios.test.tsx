import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { LiveSnapshot } from "../../src/modules/live/api/types.ts";
import type { LivePresentationModel } from "../../src/modules/live/model/presentation.ts";
import type { LegacyLiveUser } from "../../src/modules/live/model/serverData.ts";
import { ParticipantFinalResult } from "../../src/modules/live/participant/ui/ParticipantFinalResult.tsx";
import { ParticipantLeaderboard } from "../../src/modules/live/participant/ui/ParticipantLeaderboard.tsx";
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

const participantSnapshot: LiveSnapshot = {
  role: "participant",
  session: {
    id: "session-1",
    presentation_id: "presentation-1",
    state: "presenting",
    state_version: 7,
    active_item_id: null,
    activity_phase: "revealed",
    stage_view: "overall_ranking",
    ends_at: null,
    remaining_seconds: null,
  },
  participant: {
    id: "participant-1",
    display_name: "شرکت‌کننده تنها",
    avatar: "🙂",
    score: 80,
    rank: 1,
  },
  participant_count: 1,
  has_responded: false,
  has_scoring: true,
  last_event_id: 11,
};

const managerSnapshot: LiveSnapshot = {
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
  participant_count: 1,
  has_scoring: true,
  last_event_id: 12,
  activity_top_performers: [],
};

const context = (
  snapshot: LiveSnapshot,
  overrides: Partial<LiveSessionContextValue> = {},
): LiveSessionContextValue => ({
  isConnected: true,
  isStreamConnected: true,
  connectionError: null,
  sessionId: "session-1",
  snapshot,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "score",
  hasMoreRoster: false,
  isRosterLoading: false,
  participantCount: 1,
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

test("solo participant leaderboard avoids meaningless rank one of one", () => {
  render(
    <LiveSessionContext.Provider value={context(participantSnapshot)}>
      <ParticipantLeaderboard quiz={quiz} />
    </LiveSessionContext.Provider>,
  );

  expect(screen.getByText("فعلاً تنها شرکت‌کننده جلسه هستید")).not.toBeNull();
  expect(screen.queryByText(/رتبه ۱ از ۱ شرکت‌کننده/)).toBeNull();
  expect(screen.getByText("۸۰")).not.toBeNull();
});

test("solo participant final result keeps score but hides competitive rank", () => {
  const endedParticipant = {
    ...participantSnapshot,
    session: {
      ...participantSnapshot.session,
      state: "ended" as const,
      activity_phase: null,
      stage_view: "item" as const,
      active_item_id: null,
    },
  } as LiveSnapshot;

  render(
    <LiveSessionContext.Provider value={context(endedParticipant)}>
      <ParticipantFinalResult quiz={quiz} />
    </LiveSessionContext.Provider>,
  );

  expect(screen.getByText("نتیجه انفرادی ثبت شد")).not.toBeNull();
  expect(screen.queryByText("رتبه نهایی")).toBeNull();
  expect(screen.getByText("۸۰")).not.toBeNull();
});

test("solo manager final result shows score rather than a one-person podium", () => {
  const rows: LegacyLiveUser[] = [
    {
      user_id: "participant-1",
      name: "شرکت‌کننده تنها",
      character: "🙂",
      rank: 1,
      total_points: 80,
      new_points: null,
    },
  ];

  render(
    <LiveSessionContext.Provider value={context(managerSnapshot)}>
      <ManagerFinalLeaderboard
        leaderboardData={rows}
        quiz={quiz}
        onExit={vi.fn()}
      />
    </LiveSessionContext.Provider>,
  );

  expect(
    screen.getByRole("heading", { name: "نتیجه انفرادی" }),
  ).not.toBeNull();
  expect(
    screen.getByText("امتیاز نهایی؛ رتبه رقابتی برای جلسه تک‌نفره نمایش داده نمی‌شود."),
  ).not.toBeNull();
  expect(screen.queryByLabelText("رتبه ۱")).toBeNull();
});

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLiveSnapshot: vi.fn(),
}));

vi.mock("../../src/modules/live/api/liveApi.ts", () => ({
  getLiveSnapshot: api.getLiveSnapshot,
}));

import type { ActivityPhase } from "../../src/modules/live/api/types.ts";
import { useManagerActivityProgress } from "../../src/modules/live/manager/useManagerActivityProgress.ts";

afterEach(() => {
  api.getLiveSnapshot.mockReset();
});

test("Backstage progress reads the manager-only accepting response count", async () => {
  api.getLiveSnapshot.mockResolvedValue({
    role: "manager",
    session: {
      id: "session-1",
      presentation_id: "presentation-1",
      host_id: "manager-1",
      join_code: "ROOM1",
      state: "presenting",
      state_version: 7,
      active_item_id: "activity-1",
      activity_phase: "accepting",
      stage_view: "item",
      ends_at: "2026-09-29T14:00:00Z",
    },
    presentation: {
      title: "ارائه",
      background_color: "#1e1e2e",
      background_image_url: "",
      music_url: "",
      text_color: "#ffffff",
    },
    participant_count: 10,
    active_participant_count: 8,
    active_activity_response_count: 6,
    has_scoring: false,
    last_event_id: 12,
    activity_top_performers: [],
  });

  const { result } = renderHook(() =>
    useManagerActivityProgress({
      enabled: true,
      sessionId: "session-1",
      activeItemId: "activity-1",
      activityPhase: "accepting",
      fallbackCount: 2,
    }),
  );

  expect(result.current).toBe(2);
  await waitFor(() => expect(result.current).toBe(6));
  expect(api.getLiveSnapshot).toHaveBeenCalledTimes(1);
  expect(api.getLiveSnapshot).toHaveBeenCalledWith("session-1", {
    viewer: "manager",
  });
});

test("projected or closed surfaces do not start Backstage progress polling", async () => {
  const { result, rerender } = renderHook(
    ({
      enabled,
      phase,
    }: {
      enabled: boolean;
      phase: ActivityPhase;
    }) =>
      useManagerActivityProgress({
        enabled,
        sessionId: "session-1",
        activeItemId: "activity-1",
        activityPhase: phase,
        fallbackCount: 3,
      }),
    {
      initialProps: {
        enabled: false,
        phase: "accepting" as ActivityPhase,
      },
    },
  );

  expect(result.current).toBe(3);
  expect(api.getLiveSnapshot).not.toHaveBeenCalled();

  rerender({ enabled: true, phase: "closed" });
  await Promise.resolve();
  expect(api.getLiveSnapshot).not.toHaveBeenCalled();
});

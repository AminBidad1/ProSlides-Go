import test from "node:test";
import assert from "node:assert/strict";

import { LiveAPIError } from "../src/modules/live/api/liveApi.ts";
import { createLiveRuntime } from "../src/modules/live/runtime/LiveRuntime.ts";

const managerSession = (
  id,
  state = "lobby",
  stateVersion = 1,
  {
    activityPhase = null,
    stageView = "item",
    activeItemId = null,
    endsAt = null,
    remainingSeconds = null,
  } = {},
) => ({
  id,
  presentation_id: "presentation",
  host_id: "manager",
  join_code: "123456",
  state,
  state_version: stateVersion,
  active_item_id: activeItemId,
  activity_phase: activityPhase,
  stage_view: stageView,
  ends_at: endsAt,
  remaining_seconds: remainingSeconds,
});

const managerSnapshot = (
  id,
  {
    eventId = 1,
    stateVersion = 1,
    state = "lobby",
    activityPhase = null,
    stageView = "item",
    activeItemId = null,
  } = {},
) => ({
  role: "manager",
  session: managerSession(id, state, stateVersion, {
    activityPhase,
    stageView,
    activeItemId,
  }),
  participant_count: 0,
  last_event_id: eventId,
});

const emptyRoster = (order = "joined") => ({
  items: [],
  order,
  limit: 100,
  has_more: false,
  next_cursor: "",
});

const parkedStream = async (_id, _lastEventId, { signal, onOpen }) => {
  onOpen?.();
  return new Promise((resolve) => {
    signal.addEventListener("abort", resolve, { once: true });
  });
};

test("disconnect resets the authoritative cursor before selecting another session", async () => {
  let requestedPresentation = "";
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000001",
      createLiveSession: async (presentationId) => {
        requestedPresentation = presentationId;
        return managerSession(`session-${presentationId}`);
      },
      getLiveSnapshot: async (id) =>
        id === "session-first"
          ? managerSnapshot(id, { eventId: 50, stateVersion: 9 })
          : managerSnapshot(id, { eventId: 1, stateVersion: 1 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("first"), true);
  assert.equal(requestedPresentation, "first");
  assert.equal(runtime.getState().snapshot.last_event_id, 50);

  runtime.disconnect();
  assert.equal(runtime.getState().sessionId, null);
  assert.equal(runtime.getState().snapshot, null);

  assert.equal(await runtime.connect("second"), true);
  assert.equal(requestedPresentation, "second");
  assert.equal(runtime.getState().snapshot.session.id, "session-second");
  assert.equal(runtime.getState().snapshot.last_event_id, 1);

  runtime.destroy();
});

test("manager bootstrap loads frozen session items once and preserves them across refreshes", async () => {
  const snapshotOptions = [];
  let current = managerSnapshot("session", {
    eventId: 7,
    stateVersion: 3,
    state: "presenting",
    activityPhase: "accepting",
    activeItemId: "cloud-1",
  });
  const frozenItems = [
    {
      id: "cloud-1",
      revision: 2,
      position: 0,
      kind: "activity",
      content: {
        schema_version: 1,
        activity_kind: "text",
        prompt: { title: "", text: "ابر واژه", image_url: "" },
        response: { max_length: 80, max_words: 3 },
        evaluation: { mode: "none" },
        scoring: { mode: "none" },
        timing: { duration_seconds: 30 },
        results: {
          aggregation: "word_frequency",
          show_overall_leaderboard_after: false,
        },
      },
    },
  ];

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000031",
      createLiveSession: async () => current.session,
      getLiveSnapshot: async (_id, options) => {
        snapshotOptions.push(options);
        return options?.includeItems
          ? { ...current, items: frozenItems }
          : current;
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      applyLiveAction: async (_id, input) => {
        current = managerSnapshot("session", {
          eventId: 8,
          stateVersion: 4,
          state: "presenting",
          activityPhase:
            input.action === "close_activity" ? "closed" : "accepting",
          activeItemId: "cloud-1",
        });
        return current.session;
      },
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.deepEqual(snapshotOptions[0], {
    includeItems: true,
    viewer: "manager",
  });
  assert.equal(runtime.getState().snapshot.items[0].id, "cloud-1");

  assert.equal(await runtime.sendManagerAction("close_activity"), true);
  assert.deepEqual(snapshotOptions.at(-1), { viewer: "manager" });
  assert.equal(runtime.getState().snapshot.items[0].id, "cloud-1");

  runtime.destroy();
});

test("runtime accepts monotonic Activity results and ignores stale SSE events", async () => {
  let onEvent = null;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000002",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () =>
        managerSnapshot("session", { eventId: 10, stateVersion: 2 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(typeof onEvent, "function");

  onEvent({
    event_id: 11,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "activity.result_updated",
    payload: {
      activity_item_id: "q1",
      activity_kind: "choice",
      schema_version: 1,
      response_count: 3,
      payload: { option_counts: { 0: 1, 1: 2 } },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(
    runtime.getState().snapshot.activity_result.payload.option_counts,
    { 0: 1, 1: 2 },
  );

  onEvent({
    event_id: 9,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "activity.result_updated",
    payload: {
      activity_item_id: "q1",
      activity_kind: "choice",
      schema_version: 1,
      response_count: 99,
      payload: { option_counts: { 0: 99 } },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.deepEqual(
    runtime.getState().snapshot.activity_result.payload.option_counts,
    { 0: 1, 1: 2 },
  );

  runtime.destroy();
});

test("runtime ignores pre-generic Choice result envelopes after migration", async () => {
  let onEvent = null;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000003",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () =>
        managerSnapshot("session", { eventId: 20, stateVersion: 4 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  onEvent({
    event_id: 21,
    schema_version: 1,
    session_id: "session",
    state_version: 4,
    name: "activity.result_updated",
    payload: {
      activity_item_id: "legacy-choice",
      response_count: 5,
      option_counts: { 0: 2, 1: 3 },
    },
    occurred_at: new Date().toISOString(),
  });

  assert.equal(runtime.getState().snapshot.activity_result, undefined);
  runtime.destroy();
});

test("failed manager actions reuse the same request id on retry", async () => {
  let sequence = 0;
  let current = managerSnapshot("session", {
    eventId: 4,
    stateVersion: 2,
    state: "lobby",
  });
  const actionRequestIds = [];
  let failFirstAction = true;

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      createLiveSession: async () => managerSession("session", "lobby", 2),
      getLiveSnapshot: async () => current,
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
      applyLiveAction: async (_id, input) => {
        actionRequestIds.push(input.request_id);
        if (failFirstAction) {
          failFirstAction = false;
          throw new Error("temporary failure");
        }
        current = managerSnapshot("session", {
          eventId: 5,
          stateVersion: 3,
          state: "presenting",
          activityPhase: "accepting",
          activeItemId: "q1",
        });
        return current.session;
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const slide = { item_kind: "activity", slide_id: "q1", question_time: 30 };

  assert.equal(await runtime.sendNavigation("start", { slide }), false);
  assert.equal(await runtime.sendNavigation("start", { slide }), true);
  assert.equal(actionRequestIds.length, 2);
  assert.equal(actionRequestIds[0], actionRequestIds[1]);
  assert.equal(runtime.getState().snapshot.session.state, "presenting");
  assert.equal(runtime.getState().snapshot.session.activity_phase, "accepting");

  runtime.destroy();
});

test("a pre-command snapshot refresh cannot roll back a successful present_item", async () => {
  let onEvent = null;
  let resolveStaleRefresh = null;
  let snapshotReads = 0;

  const initial = {
    ...managerSnapshot("session", {
      eventId: 2,
      stateVersion: 2,
      state: "presenting",
      activityPhase: "revealed",
      activeItemId: "choice-1",
    }),
    items: [
      {
        id: "cloud-1",
        revision: 1,
        position: 1,
        kind: "activity",
        content: {
          schema_version: 1,
          activity_kind: "text",
          prompt: { title: "", text: "ابر واژه", image_url: "" },
          response: { max_length: 80, max_words: 3 },
          evaluation: { mode: "none" },
          scoring: { mode: "none" },
          timing: { duration_seconds: 30 },
          results: {
            aggregation: "word_frequency",
            show_overall_leaderboard_after: false,
          },
        },
      },
    ],
    active_item: {
      id: "choice-1",
      position: 0,
      kind: "activity",
      content: {
        schema_version: 1,
        activity_kind: "choice",
        prompt: { title: "", text: "سؤال قبلی", image_url: "" },
        response: { selection: "single", options: [] },
        evaluation: { mode: "none" },
        scoring: { mode: "none" },
        timing: { duration_seconds: 30 },
        results: { show_overall_leaderboard_after: false },
      },
    },
  };
  const fresh = managerSnapshot("session", {
    eventId: 4,
    stateVersion: 3,
    state: "presenting",
    activityPhase: "accepting",
    activeItemId: "cloud-1",
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000051",
      createLiveSession: async () => initial.session,
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) return initial;
        if (snapshotReads === 2) {
          return new Promise((resolve) => {
            resolveStaleRefresh = () =>
              resolve(
                managerSnapshot("session", {
                  eventId: 3,
                  stateVersion: 2,
                  state: "presenting",
                  activityPhase: "revealed",
                  activeItemId: "choice-1",
                }),
              );
          });
        }
        return fresh;
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      applyLiveAction: async () => fresh.session,
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        options.onOpen?.();
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(typeof onEvent, "function");

  const observedVersions = [];
  runtime.subscribe(() => {
    const version = runtime.getState().snapshot?.session?.state_version;
    if (version != null) observedVersions.push(version);
  });

  onEvent({
    event_id: 3,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "session.state_changed",
    payload: {},
    occurred_at: new Date().toISOString(),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(typeof resolveStaleRefresh, "function");

  const navigation = runtime.sendNavigation("next", {
    slide: {
      item_kind: "activity",
      slide_id: "cloud-1",
      question_time: 30,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(runtime.getState().snapshot.session.state_version, 3);
  assert.equal(runtime.getState().snapshot.session.active_item_id, "cloud-1");
  assert.equal(runtime.getState().snapshot.active_item.id, "cloud-1");

  resolveStaleRefresh();
  assert.equal(await navigation, true);

  const committedIndex = observedVersions.indexOf(3);
  assert.notEqual(committedIndex, -1);
  assert.equal(observedVersions.slice(committedIndex + 1).includes(2), false);
  assert.equal(runtime.getState().snapshot.session.state_version, 3);
  assert.equal(runtime.getState().snapshot.session.active_item_id, "cloud-1");

  runtime.destroy();
});

test("stale manager commands recover authoritative state before the next attempt", async () => {
  let sequence = 0;
  let snapshotReads = 0;
  let current = managerSnapshot("session", {
    eventId: 4,
    stateVersion: 4,
    state: "presenting",
    activityPhase: "accepting",
    activeItemId: "q1",
  });
  const commands = [];

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      createLiveSession: async () => current.session,
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        return current;
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      applyLiveAction: async (_id, input) => {
        commands.push({ action: input.action, requestId: input.request_id });
        if (commands.length === 1) {
          current = managerSnapshot("session", {
            eventId: 5,
            stateVersion: 5,
            state: "presenting",
            activityPhase: "closed",
            activeItemId: "q1",
          });
          throw new LiveAPIError(409, "conflict");
        }
        current = managerSnapshot("session", {
          eventId: 6,
          stateVersion: 6,
          state: "presenting",
          activityPhase: "revealed",
          activeItemId: "q1",
        });
        return current.session;
      },
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const readsAfterConnect = snapshotReads;

  assert.equal(await runtime.sendNavigation("next"), false);
  assert.ok(snapshotReads > readsAfterConnect);
  assert.equal(runtime.getState().snapshot.session.activity_phase, "closed");

  assert.equal(await runtime.sendNavigation("next"), true);
  assert.deepEqual(commands.map((entry) => entry.action), [
    "close_activity",
    "reveal_activity",
  ]);
  assert.notEqual(commands[0].requestId, commands[1].requestId);
  assert.equal(runtime.getState().snapshot.session.activity_phase, "revealed");

  runtime.destroy();
});

test("ranking transition clears joined roster before score refresh completes", async () => {
  let snapshotReads = 0;
  let resolveRankingSnapshot;
  const rankedSnapshot = managerSnapshot("session", {
    eventId: 8,
    stateVersion: 4,
    state: "presenting",
    activityPhase: "revealed",
    stageView: "overall_ranking",
    activeItemId: "q1",
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000041",
      createLiveSession: async () =>
        managerSession("session", "presenting", 3, {
          activityPhase: "revealed",
          activeItemId: "q1",
        }),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) {
          return managerSnapshot("session", {
            eventId: 7,
            stateVersion: 3,
            state: "presenting",
            activityPhase: "revealed",
            activeItemId: "q1",
          });
        }
        return new Promise((resolve) => {
          resolveRankingSnapshot = () => resolve(rankedSnapshot);
        });
      },
      getRosterPage: async (_id, order) => ({
        ...emptyRoster(order),
        items:
          order === "score"
            ? [{
                participant_id: "ranked",
                display_name: "Ranked",
                score: 100,
                joined_at: new Date().toISOString(),
              }]
            : [{
                participant_id: "joined-first",
                display_name: "Joined first",
                score: 1,
                joined_at: new Date().toISOString(),
              }],
      }),
      applyLiveAction: async () => rankedSnapshot.session,
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(runtime.getState().roster[0].participant_id, "joined-first");

  const rankingRequest = runtime.sendManagerAction("show_overall_ranking");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(
    runtime.getState().snapshot.session.stage_view,
    "overall_ranking",
  );
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.deepEqual(runtime.getState().roster, []);

  resolveRankingSnapshot();
  assert.equal(await rankingRequest, true);
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.equal(runtime.getState().roster[0].participant_id, "ranked");

  runtime.destroy();
});

test("explicit manager Activity controls refresh authoritative state", async () => {
  const applied = [];
  let current = managerSnapshot("session", {
    eventId: 3,
    stateVersion: 4,
    state: "presenting",
    activityPhase: "accepting",
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createLiveSession: async () => current.session,
      getLiveSnapshot: async () => current,
      getRosterPage: async (_id, order) => emptyRoster(order),
      applyLiveAction: async (_id, input) => {
        applied.push(input.action);
        current = managerSnapshot("session", {
          eventId: current.last_event_id + 1,
          stateVersion: current.session.state_version + 1,
          state: "presenting",
          activityPhase:
            input.action === "close_activity"
              ? "closed"
              : input.action === "reveal_activity"
                ? "revealed"
                : current.session.activity_phase,
          stageView:
            input.action === "show_overall_ranking"
              ? "overall_ranking"
              : current.session.stage_view,
        });
        return current.session;
      },
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(await runtime.sendManagerAction("close_activity"), true);
  assert.equal(runtime.getState().snapshot.session.activity_phase, "closed");
  assert.equal(await runtime.sendManagerAction("reveal_activity"), true);
  assert.equal(runtime.getState().snapshot.session.activity_phase, "revealed");
  assert.equal(await runtime.sendManagerAction("show_overall_ranking"), true);
  assert.equal(runtime.getState().snapshot.session.stage_view, "overall_ranking");
  assert.deepEqual(applied, [
    "close_activity",
    "reveal_activity",
    "show_overall_ranking",
  ]);
  runtime.destroy();
});

test("stream reconnect refreshes the snapshot before resuming from the new cursor", async () => {
  let snapshotReads = 0;
  const streamCursors = [];

  const runtime = createLiveRuntime("manager", {
    storage: null,
    sleep: async () => {},
    random: () => 0.5,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000010",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        return snapshotReads === 1
          ? managerSnapshot("session", { eventId: 5, stateVersion: 1 })
          : managerSnapshot("session", { eventId: 8, stateVersion: 2 });
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, lastEventId, options) => {
        streamCursors.push(lastEventId);
        if (streamCursors.length === 1) {
          throw new Error("network interrupted");
        }
        return parkedStream(_id, lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);

  for (let index = 0; index < 20 && streamCursors.length < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.deepEqual(streamCursors.slice(0, 2), [5, 8]);
  assert.equal(runtime.getState().snapshot.last_event_id, 8);
  assert.equal(runtime.getState().isConnected, true);

  runtime.destroy();
});

test("SSE reconnect honors server Retry-After before retrying", async () => {
  const delays = [];
  let streamAttempts = 0;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    random: () => 0.5,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000099",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () =>
        managerSnapshot("session", { eventId: 5, stateVersion: 1 }),
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: async (_id, _lastEventId, options) => {
        assert.equal(options.viewer, "manager");
        streamAttempts += 1;
        if (streamAttempts === 1) {
          throw new LiveAPIError(429, "event_stream_unavailable", 3_500);
        }
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  for (let index = 0; index < 20 && streamAttempts < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(delays[0], 3_500);
  assert.equal(streamAttempts >= 2, true);
  runtime.destroy();
});

test("presence updates preserve score ordering while the manager is on a leaderboard", async () => {
  let onEvent = null;
  const rosterOrders = [];
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000020",
      createLiveSession: async () =>
        managerSession("session", "presenting", 3, {
          activityPhase: "revealed",
          stageView: "overall_ranking",
          activeItemId: "q1",
        }),
      getLiveSnapshot: async () =>
        managerSnapshot("session", {
          eventId: 20,
          stateVersion: 3,
          state: "presenting",
          activityPhase: "revealed",
          stageView: "overall_ranking",
          activeItemId: "q1",
        }),
      getRosterPage: async (_id, order) => {
        rosterOrders.push(order);
        return emptyRoster(order);
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(rosterOrders.at(-1), "score");

  onEvent({
    event_id: 21,
    schema_version: 1,
    session_id: "session",
    state_version: 3,
    name: "presence.updated",
    payload: { participant_delta: 1, active_participant_delta: 1 },
    occurred_at: new Date().toISOString(),
  });

  for (let index = 0; index < 10 && rosterOrders.length < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(rosterOrders.at(-1), "score");
  runtime.destroy();
});

test("older roster responses cannot overwrite a newer roster request", async () => {
  let resolveJoined;
  let phase = "connect";
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000021",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => managerSnapshot("session"),
      getRosterPage: async (_id, order) => {
        if (phase === "connect") return emptyRoster(order);
        if (order === "joined") {
          return new Promise((resolve) => {
            resolveJoined = () =>
              resolve({
                ...emptyRoster("joined"),
                items: [{
                  participant_id: "stale",
                  display_name: "Stale",
                  score: 1,
                  joined_at: new Date().toISOString(),
                }],
              });
          });
        }
        return {
          ...emptyRoster("score"),
          items: [{
            participant_id: "ranked",
            display_name: "Ranked",
            score: 100,
            joined_at: new Date().toISOString(),
          }],
        };
      },
      streamLiveEvents: parkedStream,
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  phase = "race";

  const staleRequest = runtime.loadRoster("joined", false);
  const currentRequest = runtime.loadRoster("score", false);
  assert.equal(await currentRequest, true);
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.equal(runtime.getState().roster[0].participant_id, "ranked");

  resolveJoined();
  assert.equal(await staleRequest, false);
  assert.equal(runtime.getState().rosterOrder, "score");
  assert.equal(runtime.getState().roster[0].participant_id, "ranked");

  runtime.destroy();
});

test("a successful manager mutation stays successful when only the follow-up refresh fails", async () => {
  let snapshotReads = 0;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000022",
      createLiveSession: async () => managerSession("session", "lobby", 1),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) {
          return managerSnapshot("session", {
            eventId: 1,
            stateVersion: 1,
            state: "lobby",
          });
        }
        throw new Error("snapshot temporarily unavailable");
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
      applyLiveAction: async () =>
        managerSession("session", "presenting", 2, {
          activityPhase: "accepting",
          activeItemId: "q1",
        }),
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  const ok = await runtime.sendNavigation("start", {
    slide: { item_kind: "activity", slide_id: "q1", question_time: 30 },
  });

  assert.equal(ok, true);
  assert.equal(runtime.getState().snapshot.session.state, "presenting");
  assert.equal(runtime.getState().snapshot.session.activity_phase, "accepting");
  assert.equal(runtime.getState().connectionError, "snapshot temporarily unavailable");

  runtime.destroy();
});

test("refresh requests arriving during roster loading are drained before reconnect continues", async () => {
  let onEvent = null;
  let snapshotReads = 0;
  let rosterReads = 0;
  let releaseRoster;
  const blockedRoster = new Promise((resolve) => {
    releaseRoster = resolve;
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000023",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        snapshotReads += 1;
        if (snapshotReads === 1) {
          return managerSnapshot("session", {
            eventId: 1,
            stateVersion: 1,
            state: "lobby",
          });
        }
        if (snapshotReads === 2) {
          return managerSnapshot("session", {
            eventId: 2,
            stateVersion: 2,
            state: "presenting",
          });
        }
        return managerSnapshot("session", {
          eventId: 3,
          stateVersion: 3,
          state: "presenting",
        });
      },
      getRosterPage: async (_id, order) => {
        rosterReads += 1;
        if (rosterReads === 2) await blockedRoster;
        return emptyRoster(order);
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);

  onEvent({
    event_id: 2,
    schema_version: 1,
    session_id: "session",
    state_version: 2,
    name: "session.state_changed",
    payload: {},
    occurred_at: new Date().toISOString(),
  });

  for (let index = 0; index < 20 && rosterReads < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(rosterReads, 2);

  onEvent({
    event_id: 3,
    schema_version: 1,
    session_id: "session",
    state_version: 3,
    name: "ranking.updated",
    payload: {},
    occurred_at: new Date().toISOString(),
  });

  releaseRoster();

  for (let index = 0; index < 20 && snapshotReads < 3; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(snapshotReads, 3);
  assert.equal(runtime.getState().snapshot.last_event_id, 3);
  assert.equal(runtime.getState().snapshot.session.state_version, 3);
  runtime.destroy();
});

test("disconnect during manager connect cannot resurrect stale session state", async () => {
  let releaseSnapshot;
  const snapshotReady = new Promise((resolve) => {
    releaseSnapshot = resolve;
  });

  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000024",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () => {
        await snapshotReady;
        return managerSnapshot("session", {
          eventId: 9,
          stateVersion: 4,
          state: "lobby",
        });
      },
      getRosterPage: async (_id, order) => emptyRoster(order),
      streamLiveEvents: parkedStream,
    },
  });

  const connecting = runtime.connect("presentation");
  for (let index = 0; index < 10 && runtime.getState().sessionId !== "session"; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  runtime.disconnect();
  releaseSnapshot();

  assert.equal(await connecting, false);
  assert.equal(runtime.getState().sessionId, null);
  assert.equal(runtime.getState().snapshot, null);
  assert.equal(runtime.getState().isConnected, false);

  runtime.destroy();
});



test("successful participant answer retry clears the transient submission error", async () => {
  let attempts = 0;
  const requestIds = [];
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000030",
      submitLiveAnswer: async (_id, input) => {
        attempts += 1;
        requestIds.push(input.request_id);
        if (attempts === 1) throw new Error("temporary answer failure");
        return { score_delta: 100 };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  const answer = {
    request_id: "00000000-0000-4000-8000-000000000031",
    activity_item_id: "11111111-1111-4111-8111-111111111111",
    response: { selected_option_indexes: [0] },
  };

  assert.equal(await runtime.submitAnswer(answer), false);
  assert.equal(runtime.getState().connectionError, null);

  assert.equal(await runtime.submitAnswer(answer), true);
  assert.equal(runtime.getState().connectionError, null);
  assert.deepEqual(requestIds, [answer.request_id, answer.request_id]);

  runtime.destroy();
});


test("participant answer validation rejects malformed option indexes before transport", async () => {
  let submissions = 0;
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      submitLiveAnswer: async () => {
        submissions += 1;
        return { score_delta: 0 };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.submitAnswer({
      activity_item_id: "q1",
      response: { selected_option_indexes: [1, 1] },
    }),
    "rejected",
  );
  assert.equal(
    await runtime.submitAnswer({
      activity_item_id: "q1",
      response: { selected_option_indexes: [-1] },
    }),
    "rejected",
  );
  assert.equal(submissions, 0);
  runtime.destroy();
});


test("participant runtime submits Text Activity responses through the same command boundary", async () => {
  const submitted = [];
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      submitLiveAnswer: async (_id, input) => {
        submitted.push(input);
        return {
          answer_id: "answer-text",
          score_delta: 0,
          duplicate: false,
        };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.submitAnswer({
      request_id: "00000000-0000-4000-8000-000000000039",
      activity_item_id: "cloud-1",
      response: { text: "داده هوش" },
    }),
    true,
  );
  assert.deepEqual(submitted[0].response, { text: "داده هوش" });

  assert.equal(
    await runtime.submitAnswer({
      activity_item_id: "cloud-1",
      response: { text: "   " },
    }),
    "rejected",
  );
  assert.equal(submitted.length, 1);
  runtime.destroy();
});

test("participant answer HTTP remains available while SSE is reconnecting", async () => {
  let submissions = 0;
  const participantSnapshot = {
    role: "participant",
    session: {
      id: "session",
      presentation_id: "presentation",
      state: "presenting",
      state_version: 2,
      active_item_id: "q1",
      activity_phase: "accepting",
      stage_view: "item",
      ends_at: new Date(Date.now() + 30_000).toISOString(),
      remaining_seconds: 30,
    },
    participant: {
      id: "participant",
      display_name: "Player",
      avatar: "🙂",
      score: 0,
    },
    participant_count: 1,
    last_event_id: 2,
  };

  const participantSnapshotOptions = [];
  const participantStreamViewers = [];
  const runtime = createLiveRuntime("player", {
    storage: null,
    sleep: async (_milliseconds, signal) =>
      new Promise((resolve) => {
        signal.addEventListener("abort", resolve, { once: true });
      }),
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000040",
      joinLiveSession: async () => ({
        id: "participant",
        display_name: "Player",
        avatar: "🙂",
      }),
      getLiveSnapshot: async (_id, options) => {
        participantSnapshotOptions.push(options);
        return participantSnapshot;
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        participantStreamViewers.push(options.viewer);
        throw new Error("sse temporarily unavailable");
      },
      submitLiveAnswer: async (_id, input) => {
        submissions += 1;
        assert.deepEqual(input.response, {
          selected_option_indexes: [0],
        });
        return {
          answer_id: "answer",
          score_delta: 100,
          duplicate: false,
        };
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.joinParticipant({
      name: "Player",
      avatar: "🙂",
      clientUserId: "00000000-0000-4000-8000-000000000041",
    }),
    true,
  );

  for (
    let index = 0;
    index < 20 && runtime.getState().isStreamConnected;
    index += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(runtime.getState().isConnected, true);
  assert.equal(runtime.getState().isStreamConnected, false);
  assert.equal(
    runtime.getState().connectionError,
    "sse temporarily unavailable",
  );

  assert.equal(
    await runtime.submitAnswer({
      request_id: "00000000-0000-4000-8000-000000000042",
      activity_item_id: "q1",
      response: { selected_option_indexes: [0] },
    }),
    true,
  );
  assert.equal(submissions, 1);
  assert.deepEqual(participantSnapshotOptions.at(-1), {
    viewer: "participant",
  });
  assert.equal(participantStreamViewers[0], "participant");
  assert.equal(runtime.getState().isConnected, true);
  assert.equal(runtime.getState().isStreamConnected, false);
  assert.equal(
    runtime.getState().connectionError,
    "sse temporarily unavailable",
  );

  runtime.destroy();
});


test("participant join exposes precise retry outcomes for name conflicts and rate limits", async () => {
  const runtime = createLiveRuntime("player", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000101",
      joinLiveSession: async () => {
        throw new LiveAPIError(409, "display_name_taken");
      },
    },
  });

  assert.equal(await runtime.connect("session"), true);
  assert.equal(
    await runtime.joinParticipant({
      name: "Duplicate",
      avatar: "🙂",
      clientUserId: "00000000-0000-4000-8000-000000000102",
    }),
    "name_taken",
  );

  runtime.destroy();

  const limitedRuntime = createLiveRuntime("player", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000103",
      joinLiveSession: async () => {
        throw new LiveAPIError(429, "rate_limited", 2_000);
      },
    },
  });

  assert.equal(await limitedRuntime.connect("session"), true);
  assert.deepEqual(
    await limitedRuntime.joinParticipant({
      name: "Player",
      avatar: "🙂",
      clientUserId: "00000000-0000-4000-8000-000000000104",
    }),
    { status: "rate_limited", retryAfterMs: 2_000 },
  );

  limitedRuntime.destroy();
});

test("manager coalesces presence bursts before refreshing the bounded roster", async () => {
  let onEvent = null;
  let rosterReads = 0;
  const runtime = createLiveRuntime("manager", {
    storage: null,
    transport: {
      createRequestId: () => "00000000-0000-4000-8000-000000000105",
      createLiveSession: async () => managerSession("session"),
      getLiveSnapshot: async () =>
        managerSnapshot("session", { eventId: 10, stateVersion: 1 }),
      getRosterPage: async (_id, order) => {
        rosterReads += 1;
        return emptyRoster(order);
      },
      streamLiveEvents: async (_id, _lastEventId, options) => {
        onEvent = options.onEvent;
        return parkedStream(_id, _lastEventId, options);
      },
    },
  });

  assert.equal(await runtime.connect("presentation"), true);
  assert.equal(rosterReads, 1);

  for (let index = 0; index < 25; index += 1) {
    onEvent({
      event_id: 11 + index,
      schema_version: 1,
      session_id: "session",
      state_version: 1,
      name: "presence.updated",
      payload: { participant_delta: 1, active_participant_delta: 1 },
      occurred_at: new Date().toISOString(),
    });
  }

  assert.equal(rosterReads, 1);
  await new Promise((resolve) => setTimeout(resolve, 325));
  assert.equal(rosterReads, 2);
  assert.equal(runtime.getState().snapshot.participant_count, 25);

  runtime.destroy();
});

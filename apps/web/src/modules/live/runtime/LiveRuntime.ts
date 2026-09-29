import {
  LiveAPIError,
  applyLiveAction,
  createLiveSession,
  createRequestId,
  getLiveSnapshot,
  getRosterPage,
  joinLiveSession,
  moderateLiveWordCloudTerm,
  streamLiveEvents,
  submitLiveAnswer,
} from "../api/liveApi.ts";
import type {
  LiveEvent,
  LiveSnapshot,
  ParticipantResult,
  ActivityResult,
  RosterEntry,
  RosterPage,
} from "../api/types.ts";
import {
  advanceLiveCursor,
  liveCursorFromSnapshot,
  planLiveEnd,
  planLiveNavigation,
  shouldApplyLiveEvent,
  type LiveActionName,
  type LiveCursor,
  type LiveNavigationCommand,
  type LiveNavigationSlide,
} from "./protocol.ts";

export type LiveClientRole = "manager" | "player";
type RosterOrder = "joined" | "score";
type LiveManagerControlAction =
  | "close_activity"
  | "reveal_activity"
  | "show_overall_ranking";

interface LiveJoinResult {
  clientUserId: string;
  participantId: string;
  displayName: string;
  avatar: string;
}

export interface LiveRuntimeState {
  isConnected: boolean;
  isStreamConnected: boolean;
  connectionError: string | null;
  sessionId: string | null;
  snapshot: LiveSnapshot | null;
  lastJoinResult: LiveJoinResult | null;
  roster: RosterEntry[];
  rosterOrder: RosterOrder;
  hasMoreRoster: boolean;
  isRosterLoading: boolean;
}

type LiveCommandSlide = LiveNavigationSlide;

export interface LiveAnswerInput {
  request_id?: string;
  activity_item_id: string | number;
  response:
    | { selected_option_indexes: number[] }
    | { text: string }
    | { entries: string[] };
}

interface RuntimeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface LiveRuntimeTransport {
  createLiveSession: typeof createLiveSession;
  getLiveSnapshot: typeof getLiveSnapshot;
  getRosterPage: typeof getRosterPage;
  joinLiveSession: typeof joinLiveSession;
  submitLiveAnswer: typeof submitLiveAnswer;
  applyLiveAction: typeof applyLiveAction;
  moderateLiveWordCloudTerm: typeof moderateLiveWordCloudTerm;
  streamLiveEvents: typeof streamLiveEvents;
  createRequestId: typeof createRequestId;
}

interface LiveRuntimeDependencies {
  transport?: Partial<LiveRuntimeTransport>;
  storage?: RuntimeStorage | null;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
}

type Listener = () => void;
const INITIAL_CURSOR: LiveCursor = { eventId: 0, stateVersion: 0 };

const initialState = (): LiveRuntimeState => ({
  isConnected: false,
  isStreamConnected: false,
  connectionError: null,
  sessionId: null,
  snapshot: null,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "joined",
  hasMoreRoster: false,
  isRosterLoading: false,
});

const defaultSleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const defaultStorage = (): RuntimeStorage | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "live_runtime_error";

const recordPayload = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const normalizeActivityResult = (payload: unknown): ActivityResult | null => {
  const raw = recordPayload(payload);
  const activityItemId = raw.activity_item_id;
  if (activityItemId == null) return null;

  const responseCount = Number(raw.response_count ?? 0);
  const normalizedResponseCount =
    Number.isFinite(responseCount) && responseCount >= 0 ? responseCount : 0;

  const activityKind = raw.activity_kind;
  const schemaVersion = Number(raw.schema_version);
  const resultPayload = recordPayload(raw.payload);
  if (
    (activityKind !== "choice" && activityKind !== "text") ||
    !Number.isFinite(schemaVersion) ||
    schemaVersion < 1
  ) {
    return null;
  }

  if (activityKind === "choice") {
    const rawCounts = recordPayload(resultPayload.option_counts);
    const optionCounts = Object.fromEntries(
      Object.entries(rawCounts).map(([key, value]) => [
        key,
        Number(value || 0),
      ]),
    );
    return {
      activity_item_id: String(activityItemId),
      activity_kind: "choice",
      schema_version: schemaVersion,
      response_count: normalizedResponseCount,
      payload: { option_counts: optionCounts },
    };
  }

  const rawTerms = Array.isArray(resultPayload.terms)
    ? resultPayload.terms
    : [];
  const terms = rawTerms.flatMap((value) => {
    const term = recordPayload(value);
    const text = typeof term.text === "string" ? term.text : "";
    const count = Number(term.count);
    return text && Number.isFinite(count) && count > 0
      ? [{ text, count }]
      : [];
  });
  return {
    activity_item_id: String(activityItemId),
    activity_kind: "text",
    schema_version: schemaVersion,
    response_count: normalizedResponseCount,
    payload: { terms },
  };
};

export class LiveRuntime {
  private readonly role: LiveClientRole;
  private readonly transport: LiveRuntimeTransport;
  private readonly storage: RuntimeStorage | null;
  private readonly sleep: LiveRuntimeDependencies["sleep"];
  private readonly random: () => number;
  private listeners = new Set<Listener>();
  private state: LiveRuntimeState = initialState();

  private selectedSessionId: string | null = null;
  private snapshotValue: LiveSnapshot | null = null;
  private cursor: LiveCursor = { ...INITIAL_CURSOR };
  private rosterCursor = "";
  private rosterOrderValue: RosterOrder = "joined";
  private rosterValue: RosterEntry[] = [];
  private streamAbort: AbortController | null = null;
  private refreshPromise: Promise<LiveSnapshot> | null = null;
  private refreshDirty = false;
  private commandInFlight = false;
  private pendingActionIds = new Map<string, string>();
  private lifecycleVersion = 0;
  private rosterRequestVersion = 0;
  private rosterRefreshTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private pendingRosterRefreshOrder: RosterOrder | null = null;
  private rosterRetryDelay = 500;
  private lobbySnapshotRefreshTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private destroyed = false;

  constructor(role: LiveClientRole, dependencies: LiveRuntimeDependencies = {}) {
    this.role = role;
    this.transport = {
      createLiveSession,
      getLiveSnapshot,
      getRosterPage,
      joinLiveSession,
      submitLiveAnswer,
      applyLiveAction,
      moderateLiveWordCloudTerm,
      streamLiveEvents,
      createRequestId,
      ...dependencies.transport,
    };
    this.storage = dependencies.storage === undefined ? defaultStorage() : dependencies.storage;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.random = dependencies.random ?? Math.random;
  }

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish = (patch: Partial<LiveRuntimeState>) => {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  };

  private safeStorageGet = (key: string) => {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  private safeStorageSet = (key: string, value: string) => {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Session continuity should not depend on storage availability.
    }
  };

  private invalidateTerminalPlayerProjection = (): Partial<LiveRuntimeState> => {
    if (this.role !== "player") return {};

    // A terminal participant authorization/session failure must not leave the
    // last Activity projected forever. Clearing only the participant-facing
    // projection lets the recovery hook either rejoin with its persisted
    // identity or fall back to the editable join UI.
    this.snapshotValue = null;
    this.rosterValue = [];
    this.rosterCursor = "";
    return {
      snapshot: null,
      roster: [],
      hasMoreRoster: false,
    };
  };

  private resetInternals = () => {
    this.lifecycleVersion += 1;
    this.rosterRequestVersion += 1;
    if (this.rosterRefreshTimer !== null) {
      globalThis.clearTimeout(this.rosterRefreshTimer);
      this.rosterRefreshTimer = null;
    }
    if (this.lobbySnapshotRefreshTimer !== null) {
      globalThis.clearTimeout(this.lobbySnapshotRefreshTimer);
      this.lobbySnapshotRefreshTimer = null;
    }
    this.pendingRosterRefreshOrder = null;
    this.rosterRetryDelay = 500;
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.selectedSessionId = null;
    this.snapshotValue = null;
    this.cursor = { ...INITIAL_CURSOR };
    this.rosterCursor = "";
    this.rosterOrderValue = "joined";
    this.rosterValue = [];
    this.refreshPromise = null;
    this.refreshDirty = false;
    this.commandInFlight = false;
    this.pendingActionIds.clear();
  };

  private selectSession = (sessionId: string) => {
    if (this.selectedSessionId === sessionId) return;
    this.lifecycleVersion += 1;
    this.rosterRequestVersion += 1;
    if (this.rosterRefreshTimer !== null) {
      globalThis.clearTimeout(this.rosterRefreshTimer);
      this.rosterRefreshTimer = null;
    }
    if (this.lobbySnapshotRefreshTimer !== null) {
      globalThis.clearTimeout(this.lobbySnapshotRefreshTimer);
      this.lobbySnapshotRefreshTimer = null;
    }
    this.pendingRosterRefreshOrder = null;
    this.rosterRetryDelay = 500;
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.selectedSessionId = sessionId;
    this.snapshotValue = null;
    this.cursor = { ...INITIAL_CURSOR };
    this.rosterCursor = "";
    this.rosterOrderValue = "joined";
    this.rosterValue = [];
    this.refreshPromise = null;
    this.refreshDirty = false;
    this.commandInFlight = false;
    this.pendingActionIds.clear();
    this.publish({
      sessionId,
      snapshot: null,
      isConnected: false,
      isStreamConnected: false,
      connectionError: null,
      roster: [],
      rosterOrder: "joined",
      hasMoreRoster: false,
      isRosterLoading: false,
      lastJoinResult: null,
    });
  };

  private storeSnapshot = (
    next: LiveSnapshot,
    patch: Partial<LiveRuntimeState> = {},
  ) => {
    const preservedItems =
      next.role === "manager" &&
      next.items === undefined &&
      this.snapshotValue?.role === "manager"
        ? this.snapshotValue.items
        : undefined;
    const normalized =
      next.role === "manager" && preservedItems !== undefined
        ? { ...next, items: preservedItems }
        : next;
    const incoming = liveCursorFromSnapshot(normalized);
    if (
      incoming.eventId < this.cursor.eventId ||
      incoming.stateVersion < this.cursor.stateVersion
    ) {
      return false;
    }

    this.snapshotValue = normalized;
    this.cursor = incoming;
    this.publish({
      snapshot: normalized,
      sessionId: this.selectedSessionId,
      ...patch,
    });
    return true;
  };

  loadRoster = async (
    order: RosterOrder = this.rosterOrderValue,
    append = false,
  ) => {
    const id = this.selectedSessionId;
    if (!id || this.role !== "manager") return false;
    const lifecycleVersion = this.lifecycleVersion;
    const requestVersion = ++this.rosterRequestVersion;

    this.publish({ isRosterLoading: true });
    try {
      const cursor =
        append && order === this.rosterOrderValue ? this.rosterCursor : "";
      const page: RosterPage = await this.transport.getRosterPage(
        id,
        order,
        cursor,
        100,
      );
      if (
        id !== this.selectedSessionId ||
        lifecycleVersion !== this.lifecycleVersion ||
        requestVersion !== this.rosterRequestVersion
      ) {
        return false;
      }

      const nextItems = append
        ? [...this.rosterValue, ...page.items]
        : page.items;
      this.rosterValue = nextItems;
      this.rosterCursor = page.next_cursor || "";
      this.rosterOrderValue = order;
      this.rosterRetryDelay = 500;
      if (!append && this.rosterRefreshTimer !== null) {
        globalThis.clearTimeout(this.rosterRefreshTimer);
        this.rosterRefreshTimer = null;
        this.pendingRosterRefreshOrder = null;
      }
      this.publish({
        roster: nextItems,
        rosterOrder: order,
        hasMoreRoster: page.has_more,
        ...(this.state.isStreamConnected ? { connectionError: null } : {}),
      });
      return true;
    } catch (error) {
      if (
        id === this.selectedSessionId &&
        lifecycleVersion === this.lifecycleVersion &&
        requestVersion === this.rosterRequestVersion
      ) {
        this.publish({ connectionError: errorMessage(error) });
        if (!append) {
          const retryDelay = this.rosterRetryDelay;
          this.rosterRetryDelay = Math.min(this.rosterRetryDelay * 2, 10_000);
          this.scheduleRosterRefresh(order, retryDelay);
        }
      }
      return false;
    } finally {
      if (
        id === this.selectedSessionId &&
        lifecycleVersion === this.lifecycleVersion &&
        requestVersion === this.rosterRequestVersion
      ) {
        this.publish({ isRosterLoading: false });
      }
    }
  };

  loadMoreRoster = () => this.loadRoster(this.rosterOrderValue, true);

  private scheduleRosterRefresh = (
    order: RosterOrder,
    delay = 250,
  ) => {
    this.pendingRosterRefreshOrder = order;
    if (this.rosterRefreshTimer !== null || this.destroyed) return;

    this.rosterRefreshTimer = globalThis.setTimeout(() => {
      this.rosterRefreshTimer = null;
      const pendingOrder = this.pendingRosterRefreshOrder;
      this.pendingRosterRefreshOrder = null;
      if (pendingOrder) void this.loadRoster(pendingOrder, false);
    }, delay);
  };

  private scheduleLobbySnapshotRefresh = () => {
    if (this.lobbySnapshotRefreshTimer !== null || this.destroyed) return;

    const id = this.selectedSessionId;
    const lifecycleVersion = this.lifecycleVersion;
    if (!id || this.role !== "manager") return;

    this.lobbySnapshotRefreshTimer = globalThis.setTimeout(() => {
      this.lobbySnapshotRefreshTimer = null;
      const current = this.snapshotValue;
      if (
        this.destroyed ||
        id !== this.selectedSessionId ||
        lifecycleVersion !== this.lifecycleVersion ||
        current?.role !== "manager" ||
        current.session.state !== "lobby"
      ) {
        return;
      }

      void this.transport
        .getLiveSnapshot(id, { viewer: "manager" })
        .then((next) => {
          if (
            id === this.selectedSessionId &&
            lifecycleVersion === this.lifecycleVersion &&
            next.role === "manager"
          ) {
            this.storeSnapshot(next);
          }
        })
        .catch((error) => {
          if (
            id === this.selectedSessionId &&
            lifecycleVersion === this.lifecycleVersion
          ) {
            this.publish({ connectionError: errorMessage(error) });
          }
        });
    }, 350);
  };

  private refreshAuthoritative = async (): Promise<LiveSnapshot> => {
    const id = this.selectedSessionId;
    if (!id) throw new Error("Live session is not selected");
    const lifecycleVersion = this.lifecycleVersion;

    if (this.refreshPromise) {
      this.refreshDirty = true;
      return this.refreshPromise;
    }

    const refresh = (async () => {
      let next: LiveSnapshot;
      do {
        this.refreshDirty = false;
        next = await this.transport.getLiveSnapshot(id, {
          viewer: this.role === "manager" ? "manager" : "participant",
        });
        if (
          id !== this.selectedSessionId ||
          lifecycleVersion !== this.lifecycleVersion
        ) {
          throw new Error("Live session changed during refresh");
        }

        let snapshotPatch: Partial<LiveRuntimeState> = {};
        let desiredRosterOrder: RosterOrder | null = null;
        if (next.role === "manager") {
          desiredRosterOrder =
            next.session.stage_view === "overall_ranking" ||
            next.session.state === "ended"
              ? "score"
              : "joined";
          if (desiredRosterOrder !== this.rosterOrderValue) {
            this.rosterRequestVersion += 1;
            if (this.rosterRefreshTimer !== null) {
              globalThis.clearTimeout(this.rosterRefreshTimer);
              this.rosterRefreshTimer = null;
            }
            this.pendingRosterRefreshOrder = null;
            this.rosterCursor = "";
            this.rosterOrderValue = desiredRosterOrder;
            this.rosterValue = [];
            snapshotPatch = {
              roster: [],
              rosterOrder: desiredRosterOrder,
              hasMoreRoster: false,
              isRosterLoading: false,
            };
          }
        }

        if (!this.storeSnapshot(next, snapshotPatch)) {
          this.refreshDirty = true;
          continue;
        }

        if (next.role === "manager" && desiredRosterOrder) {
          await this.loadRoster(desiredRosterOrder, false);
        } else {
          this.rosterValue = [];
          this.rosterCursor = "";
          this.publish({ roster: [], hasMoreRoster: false });
        }

        if (
          id !== this.selectedSessionId ||
          lifecycleVersion !== this.lifecycleVersion
        ) {
          throw new Error("Live session changed during refresh");
        }
      } while (
        this.refreshDirty &&
        this.selectedSessionId === id &&
        lifecycleVersion === this.lifecycleVersion
      );

      return next;
    })();

    this.refreshPromise = refresh;
    try {
      return await refresh;
    } finally {
      if (this.refreshPromise === refresh) {
        this.refreshPromise = null;
      }
    }
  };

  private handleEvent = async (event: LiveEvent) => {
    if (!shouldApplyLiveEvent(this.cursor, event)) return;

    if (event.name === "presence.updated") {
      this.cursor = advanceLiveCursor(this.cursor, event);
      const payload = recordPayload(event.payload);
      const participantDelta = Number(payload.participant_delta || 0);
      const activeParticipantDelta = Number(
        payload.active_participant_delta || 0,
      );
      if (
        this.snapshotValue &&
        (participantDelta !== 0 || activeParticipantDelta !== 0)
      ) {
        const next: LiveSnapshot = {
          ...this.snapshotValue,
          participant_count: Math.max(
            0,
            Number(this.snapshotValue.participant_count || 0) +
              participantDelta,
          ),
          active_participant_count: Math.max(
            0,
            Number(this.snapshotValue.active_participant_count || 0) +
              activeParticipantDelta,
          ),
        };
        this.snapshotValue = next;
        this.publish({ snapshot: next });
      }
      if (this.role === "manager" && participantDelta !== 0) {
        const snapshot = this.snapshotValue;
        if (snapshot?.role === "manager" && snapshot.session.state === "lobby") {
          this.scheduleLobbySnapshotRefresh();
        } else {
          const order: RosterOrder =
            snapshot &&
            (snapshot.session.stage_view === "overall_ranking" ||
              snapshot.session.state === "ended")
              ? "score"
              : "joined";
          this.scheduleRosterRefresh(order);
        }
      }
      return;
    }

    if (event.name === "activity.result_updated") {
      this.cursor = advanceLiveCursor(this.cursor, event);
      const result = normalizeActivityResult(event.payload);
      if (result && this.snapshotValue) {
        const next: LiveSnapshot = {
          ...this.snapshotValue,
          activity_result: result,
        };
        this.snapshotValue = next;
        this.publish({ snapshot: next });
      }
      return;
    }

    if (
      ["session.created", "session.state_changed", "ranking.updated"].includes(
        event.name,
      )
    ) {
      // State-changing events are only acknowledged after the authoritative
      // snapshot has caught up. If that refresh fails, keep the old cursor so
      // reconnect replay cannot skip the transition that the UI failed to apply.
      await this.refreshAuthoritative();
      if (
        this.cursor.eventId < Number(event.event_id || 0) ||
        this.cursor.stateVersion < Number(event.state_version || 0)
      ) {
        throw new Error("live_snapshot_behind_event");
      }
      if (this.role === "player") {
        this.publish({ connectionError: null });
      }
    }
  };

  private startStream = () => {
    const id = this.selectedSessionId;
    if (!id || !this.snapshotValue?.role || this.streamAbort || this.destroyed) {
      return;
    }

    const controller = new AbortController();
    this.streamAbort = controller;

    void (async () => {
      let retry = 500;
      let needsRecoverySnapshot = false;
      try {
        while (!controller.signal.aborted && id === this.selectedSessionId) {
          if (needsRecoverySnapshot) {
            try {
              await this.refreshAuthoritative();
              needsRecoverySnapshot = false;
            } catch (snapshotError) {
              if (
                controller.signal.aborted ||
                id !== this.selectedSessionId
              ) {
                return;
              }
              const terminalSnapshotFailure =
                snapshotError instanceof LiveAPIError &&
                [401, 404].includes(snapshotError.status);
              this.publish({
                ...(terminalSnapshotFailure
                  ? {
                      isConnected: false,
                      ...this.invalidateTerminalPlayerProjection(),
                    }
                  : {}),
                isStreamConnected: false,
                connectionError: errorMessage(snapshotError),
              });
              if (terminalSnapshotFailure) {
                return;
              }
              const jitter = 0.75 + this.random() * 0.5;
              const retryAfterMs =
                snapshotError instanceof LiveAPIError
                  ? snapshotError.retryAfterMs ?? 0
                  : 0;
              await this.sleep!(
                Math.max(Math.round(retry * jitter), retryAfterMs),
                controller.signal,
              );
              retry = Math.min(retry * 2, 10_000);
              continue;
            }
          }

          try {
            await this.transport.streamLiveEvents(id, this.cursor.eventId, {
              signal: controller.signal,
              viewer: this.role === "manager" ? "manager" : "participant",
              onOpen: () => {
                if (id !== this.selectedSessionId) return;
                retry = 500;
                this.publish({
                  isConnected: true,
                  isStreamConnected: true,
                  connectionError: null,
                });
              },
              onEvent: async (event) => {
                if (id !== this.selectedSessionId) return;
                await this.handleEvent(event);
              },
            });
            if (!controller.signal.aborted) {
              throw new Error("event_stream_closed");
            }
          } catch (error) {
            if (controller.signal.aborted || id !== this.selectedSessionId) {
              return;
            }

            const terminalStreamFailure =
              error instanceof LiveAPIError &&
              [401, 404].includes(error.status);
            this.publish({
              ...(terminalStreamFailure
                ? {
                    isConnected: false,
                    ...this.invalidateTerminalPlayerProjection(),
                  }
                : {}),
              isStreamConnected: false,
              connectionError: errorMessage(error),
            });
            if (terminalStreamFailure) {
              return;
            }

            needsRecoverySnapshot = true;
            const jitter = 0.75 + this.random() * 0.5;
            const retryAfterMs =
              error instanceof LiveAPIError ? error.retryAfterMs ?? 0 : 0;
            await this.sleep!(
              Math.max(Math.round(retry * jitter), retryAfterMs),
              controller.signal,
            );
            retry = Math.min(retry * 2, 10_000);
          }
        }
      } finally {
        if (this.streamAbort === controller) this.streamAbort = null;
      }
    })();
  };

  connect = async (identifier: string | number) => {
    if (!identifier) return false;
    const requestedId = String(identifier);
    this.publish({ connectionError: null });
    this.selectSession(requestedId);
    let lifecycleVersion = this.lifecycleVersion;
    let selectedId = requestedId;
    const isCurrent = () =>
      lifecycleVersion === this.lifecycleVersion &&
      selectedId === this.selectedSessionId;

    try {
      if (this.role === "player") {
        // Selecting a different Session already reset stream state. Repeating
        // connect() for the same participant Session must not demote an
        // existing healthy SSE connection.
        this.publish({ isConnected: true });
        return true;
      }

      const createKey = `proslides_live_create_request:${requestedId}`;
      let requestId = this.safeStorageGet(createKey);
      if (!requestId) {
        requestId = this.transport.createRequestId();
        this.safeStorageSet(createKey, requestId);
      }

      let created = await this.transport.createLiveSession(requestedId, requestId);
      if (!isCurrent()) return false;
      this.selectSession(created.id);
      selectedId = created.id;
      lifecycleVersion = this.lifecycleVersion;
      let next = await this.transport.getLiveSnapshot(created.id, {
        includeItems: true,
        viewer: "manager",
      });
      if (!isCurrent()) return false;

      if (next.session.state === "ended") {
        requestId = this.transport.createRequestId();
        this.safeStorageSet(createKey, requestId);
        created = await this.transport.createLiveSession(requestedId, requestId);
        if (!isCurrent()) return false;
        this.selectSession(created.id);
        selectedId = created.id;
        lifecycleVersion = this.lifecycleVersion;
        next = await this.transport.getLiveSnapshot(created.id, {
          includeItems: true,
          viewer: "manager",
        });
        if (!isCurrent()) return false;
      }

      if (next.role === "manager" && next.session.state === "draft") {
        const lobbyKey = `proslides_live_lobby_request:${next.session.id}`;
        let lobbyRequestId = this.safeStorageGet(lobbyKey);
        if (!lobbyRequestId) {
          lobbyRequestId = this.transport.createRequestId();
          this.safeStorageSet(lobbyKey, lobbyRequestId);
        }
        try {
          await this.transport.applyLiveAction(next.session.id, {
            request_id: lobbyRequestId,
            expected_state_version: next.session.state_version,
            action: "start",
          });
        } catch (error) {
          if (!(error instanceof LiveAPIError) || error.status !== 409) {
            throw error;
          }
        }
        if (!isCurrent()) return false;
        next = await this.transport.getLiveSnapshot(next.session.id, {
          includeItems: true,
        });
        if (!isCurrent()) return false;
        if (next.session.state === "draft") {
          throw new Error("Live session could not enter the lobby");
        }
      }

      if (!isCurrent()) return false;
      this.storeSnapshot(next);
      if (next.role === "manager") {
        await this.loadRoster(
          next.session.stage_view === "overall_ranking" ||
            next.session.state === "ended"
            ? "score"
            : "joined",
          false,
        );
      }
      if (!isCurrent()) return false;
      this.publish({ isConnected: true, isStreamConnected: false });
      this.startStream();
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      this.publish({
        connectionError: errorMessage(error),
        isConnected: false,
      });
      return false;
    }
  };

  resync = async () => {
    const id = this.selectedSessionId;
    const lifecycleVersion = this.lifecycleVersion;
    if (!id || !this.snapshotValue || this.destroyed) return false;

    // An explicit browser/network recovery should not wait behind an old
    // exponential-backoff sleep. Abort only a stream that is already known to
    // be disconnected; a healthy stream is left untouched.
    if (!this.state.isStreamConnected && this.streamAbort) {
      const staleController = this.streamAbort;
      this.streamAbort = null;
      staleController.abort();
    }

    try {
      await this.refreshAuthoritative();
      if (
        id !== this.selectedSessionId ||
        lifecycleVersion !== this.lifecycleVersion
      ) {
        return false;
      }

      this.publish({ isConnected: true, connectionError: null });
      this.startStream();
      return true;
    } catch (error) {
      if (
        id !== this.selectedSessionId ||
        lifecycleVersion !== this.lifecycleVersion
      ) {
        return false;
      }

      const terminal =
        error instanceof LiveAPIError && [401, 404].includes(error.status);
      if (terminal && this.streamAbort) {
        const staleController = this.streamAbort;
        this.streamAbort = null;
        staleController.abort();
      }
      this.publish({
        ...(terminal
          ? {
              isConnected: false,
              isStreamConnected: false,
              ...this.invalidateTerminalPlayerProjection(),
            }
          : {}),
        connectionError: errorMessage(error),
      });
      return false;
    }
  };

  disconnect = () => {
    this.resetInternals();
    this.state = initialState();
    if (!this.destroyed) {
      for (const listener of this.listeners) listener();
    }
  };

  private runAction = async (
    action: LiveActionName,
    slide?: LiveCommandSlide,
  ) => {
    const id = this.selectedSessionId;
    const current = this.snapshotValue;
    if (!id || current?.role !== "manager") return false;

    const itemId = slide?.slide_id == null ? "" : String(slide.slide_id);
    const key = `${id}:${current.session.state_version}:${action}:${itemId}`;
    let requestId = this.pendingActionIds.get(key);
    if (!requestId) {
      requestId = this.transport.createRequestId();
      this.pendingActionIds.set(key, requestId);
    }

    let result: Awaited<ReturnType<typeof applyLiveAction>>;
    try {
      result = await this.transport.applyLiveAction(id, {
        request_id: requestId,
        expected_state_version: current.session.state_version,
        action,
        ...(action === "present_item" && itemId ? { item_id: itemId } : {}),
      });
    } catch (error) {
      if (error instanceof LiveAPIError && error.status === 409) {
        // A stale state_version never commits this request. Drop its idempotency
        // key and recover the authoritative state so the user's next attempt
        // is based on a fresh version and a fresh request ID.
        this.pendingActionIds.delete(key);
        try {
          await this.refreshAuthoritative();
        } catch (refreshError) {
          this.publish({ connectionError: errorMessage(refreshError) });
        }
      }
      throw error;
    }

    const activeItemChanged =
      String(current.session.active_item_id ?? "") !==
      String(result.active_item_id ?? "");

    const frozenActiveItem =
      activeItemChanged && result.active_item_id
        ? current.items?.find(
            (item) => String(item.id) === String(result.active_item_id),
          )
        : undefined;
    const next: LiveSnapshot = {
      ...current,
      session: result,
      ...(activeItemChanged
        ? {
            active_item: frozenActiveItem
              ? {
                  id: frozenActiveItem.id,
                  position: frozenActiveItem.position,
                  kind: frozenActiveItem.kind,
                  content: frozenActiveItem.content,
                }
              : undefined,
            activity_result: undefined,
            activity_top_performers: [],
          }
        : {}),
    };

    // A successful command is itself authoritative for state_version. Advance
    // the local cursor immediately so an older GET that started before this
    // command cannot overwrite the freshly committed Session state.
    this.cursor = {
      ...this.cursor,
      stateVersion: Math.max(
        this.cursor.stateVersion,
        Number(result.state_version || 0),
      ),
    };
    this.snapshotValue = next;
    this.pendingActionIds.delete(key);

    if (action === "show_overall_ranking" || action === "end") {
      // Never project a joined-order roster as a ranking while the score-order
      // refresh is still in flight. Also invalidate older roster requests.
      this.rosterRequestVersion += 1;
      this.rosterCursor = "";
      this.rosterOrderValue = "score";
      this.rosterValue = [];
      this.publish({
        snapshot: next,
        roster: [],
        rosterOrder: "score",
        hasMoreRoster: false,
        isRosterLoading: false,
      });
    } else {
      this.publish({ snapshot: next });
    }
    return true;
  };

  sendNavigation = async (
    command: LiveNavigationCommand,
    options: { slide?: LiveCommandSlide } = {},
  ) => {
    if (this.commandInFlight) return false;
    this.commandInFlight = true;
    try {
      const session = this.snapshotValue?.session;
      const actions = planLiveNavigation(
        session?.state,
        command,
        options.slide,
        session?.activity_phase ?? null,
        session?.stage_view ?? "item",
      );
      for (const action of actions) {
        const applied = await this.runAction(
          action,
          action === "present_item" ? options.slide : undefined,
        );
        if (!applied) throw new Error("Live action was not authorized");
      }
      try {
        await this.refreshAuthoritative();
      } catch (refreshError) {
        this.publish({ connectionError: errorMessage(refreshError) });
      }
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  moderateWordCloudTerm = async (
    canonicalKey: string,
    hidden: boolean,
  ) => {
    if (this.commandInFlight || this.role !== "manager") return false;
    const id = this.selectedSessionId;
    const current = this.snapshotValue;
    if (
      !id ||
      current?.role !== "manager" ||
      !current.session.active_item_id ||
      !["closed", "revealed"].includes(
        String(current.session.activity_phase ?? ""),
      )
    ) {
      return false;
    }

    const moderation = current.word_cloud_moderation;
    if (
      !moderation ||
      moderation.activity_item_id !== current.session.active_item_id
    ) {
      return false;
    }

    const term = moderation.terms.find(
      (item) => item.canonical_key === canonicalKey,
    );
    if (!term || term.hidden === hidden) {
      return term?.hidden === hidden;
    }

    this.commandInFlight = true;
    const key = `${id}:${current.session.state_version}:moderate:${canonicalKey}:${hidden}`;
    let requestId = this.pendingActionIds.get(key);
    if (!requestId) {
      requestId = this.transport.createRequestId();
      this.pendingActionIds.set(key, requestId);
    }

    try {
      const result = await this.transport.moderateLiveWordCloudTerm(id, {
        request_id: requestId,
        expected_state_version: current.session.state_version,
        activity_item_id: moderation.activity_item_id,
        canonical_key: canonicalKey,
        hidden,
      });

      this.pendingActionIds.delete(key);
      this.cursor = {
        ...this.cursor,
        stateVersion: Math.max(
          this.cursor.stateVersion,
          Number(result.state_version || 0),
        ),
      };
      await this.refreshAuthoritative();
      this.publish({ connectionError: null });
      return true;
    } catch (error) {
      if (error instanceof LiveAPIError && error.status === 409) {
        this.pendingActionIds.delete(key);
        try {
          await this.refreshAuthoritative();
        } catch (refreshError) {
          this.publish({ connectionError: errorMessage(refreshError) });
        }
      } else {
        this.publish({ connectionError: errorMessage(error) });
      }
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  sendManagerAction = async (action: LiveManagerControlAction) => {
    if (this.commandInFlight || this.role !== "manager") return false;
    this.commandInFlight = true;
    try {
      if (!(await this.runAction(action))) {
        throw new Error("Live manager action was not authorized");
      }
      try {
        await this.refreshAuthoritative();
      } catch (refreshError) {
        this.publish({ connectionError: errorMessage(refreshError) });
      }
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  sendEnd = async () => {
    if (this.commandInFlight) return false;
    this.commandInFlight = true;
    try {
      const actions = planLiveEnd(
        this.snapshotValue?.session?.state,
        this.snapshotValue?.session?.activity_phase ?? null,
      );
      for (const action of actions) {
        if (!(await this.runAction(action))) {
          throw new Error("Live end action was not authorized");
        }
      }
      try {
        await this.refreshAuthoritative();
      } catch (refreshError) {
        this.publish({ connectionError: errorMessage(refreshError) });
      }
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  joinParticipant = async ({
    name,
    avatar,
    clientUserId,
  }: {
    name: string;
    avatar?: string;
    clientUserId?: string;
  }) => {
    const id = this.selectedSessionId;
    if (!id) return false;

    const requestId = /^[0-9a-f-]{36}$/i.test(String(clientUserId || ""))
      ? String(clientUserId)
      : this.transport.createRequestId();

    try {
      const participant: ParticipantResult =
        await this.transport.joinLiveSession(id, {
          request_id: requestId,
          display_name: name,
          avatar: avatar || "",
        });
      if (id !== this.selectedSessionId) return false;

      this.publish({
        connectionError: null,
        lastJoinResult: {
          clientUserId: requestId,
          participantId: participant.id,
          displayName: participant.display_name,
          avatar: participant.avatar || "",
        },
      });

      await this.refreshAuthoritative();
      // A re-join can happen while the participant's existing event stream is
      // still healthy (for example after a view-level recovery/remount). Do
      // not mark that live stream as disconnected before startStream(), because
      // startStream intentionally reuses an existing stream and would leave
      // the false flag stuck while events continue to arrive.
      this.publish({ isConnected: true });
      this.startStream();
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      if (error instanceof LiveAPIError) {
        if (error.status === 409 && error.code === "display_name_taken") {
          return "name_taken" as const;
        }
        if ([400, 404, 409].includes(error.status)) {
          if (error.status === 404) {
            if (this.streamAbort) {
              const staleController = this.streamAbort;
              this.streamAbort = null;
              staleController.abort();
            }
            this.publish({
              isConnected: false,
              isStreamConnected: false,
              ...this.invalidateTerminalPlayerProjection(),
            });
          }
          return "rejected" as const;
        }
        if (error.status === 429) {
          return {
            status: "rate_limited" as const,
            retryAfterMs: Math.max(1500, error.retryAfterMs ?? 0),
          };
        }
      }
      if (!this.state.isStreamConnected) {
        this.publish({ isConnected: false });
      }
      return false;
    }
  };

  submitAnswer = async (answer: LiveAnswerInput) => {
    const id = this.selectedSessionId;
    if (!id || !answer) return false;

    const response = answer.response;
    if ("selected_option_indexes" in response) {
      const selected = response.selected_option_indexes;
      const unique = new Set(selected);
      if (
        selected.length === 0 ||
        unique.size !== selected.length ||
        selected.some((index) => !Number.isInteger(index) || index < 0)
      ) {
        return "rejected" as const;
      }
    } else if ("text" in response) {
      if (!response.text.trim()) return "rejected" as const;
    } else if (
      response.entries.length === 0 ||
      response.entries.some((entry) => !entry.trim())
    ) {
      return "rejected" as const;
    }

    try {
      await this.transport.submitLiveAnswer(id, {
        request_id: answer.request_id || this.transport.createRequestId(),
        activity_item_id: String(answer.activity_item_id),
        response,
      });
      return true;
    } catch (error) {
      if (
        error instanceof LiveAPIError &&
        [400, 401, 409].includes(error.status)
      ) {
        return "rejected" as const;
      }
      return false;
    }
  };

  destroy = () => {
    if (this.destroyed) return;
    this.resetInternals();
    this.destroyed = true;
    this.listeners.clear();
  };
}

export const createLiveRuntime = (
  role: LiveClientRole,
  dependencies?: LiveRuntimeDependencies,
) => new LiveRuntime(role, dependencies);

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLiveStageSnapshot,
  LiveAPIError,
  streamLiveEvents,
} from "../api/liveApi.ts";
import type { LiveEvent, StageSnapshot } from "../api/types.ts";
import {
  advanceLiveCursor,
  shouldApplyLiveEvent,
  type LiveCursor,
} from "../runtime/protocol.ts";

type StageProjectionState = {
  snapshot: StageSnapshot | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: StageProjectionState = {
  snapshot: null,
  isConnected: false,
  isLoading: true,
  error: null,
};

const eventRecord = (payload: unknown): Record<string, unknown> =>
  typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

const isFatalStageError = (error: unknown) =>
  error instanceof LiveAPIError && [401, 404].includes(error.status);

const errorText = (error: unknown) => {
  if (error instanceof LiveAPIError) {
    if (error.status === 401) return "دسترسی Stage معتبر نیست.";
    if (error.status === 404) return "جلسه زنده پیدا نشد.";
    return "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…";
  }
  return error instanceof Error
    ? "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…"
    : "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…";
};

export function useStageProjection(sessionId: string | undefined) {
  const [state, setState] = useState<StageProjectionState>(initialState);
  const snapshotRef = useRef<StageSnapshot | null>(null);
  const cursorRef = useRef<LiveCursor>({ eventId: 0, stateVersion: 0 });

  const applySnapshot = useCallback((next: StageSnapshot) => {
    const current = snapshotRef.current;
    if (
      current &&
      (next.session.state_version < current.session.state_version ||
        (next.session.state_version === current.session.state_version &&
          next.last_event_id < current.last_event_id))
    ) {
      return current;
    }

    snapshotRef.current = next;
    cursorRef.current = {
      eventId: Math.max(cursorRef.current.eventId, Number(next.last_event_id || 0)),
      stateVersion: Math.max(
        cursorRef.current.stateVersion,
        Number(next.session.state_version || 0),
      ),
    };
    setState((value) => ({
      ...value,
      snapshot: next,
      isLoading: false,
      error: null,
    }));
    return next;
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setState({
        snapshot: null,
        isConnected: false,
        isLoading: false,
        error: "شناسه جلسه معتبر نیست.",
      });
      return;
    }

    const controller = new AbortController();
    snapshotRef.current = null;
    cursorRef.current = { eventId: 0, stateVersion: 0 };
    setState(initialState);

    let refreshPromise: Promise<StageSnapshot> | null = null;
    let refreshDirty = false;
    let lobbyRefreshTimer = 0;
    let wakeRetry: (() => void) | null = null;

    const waitForRetry = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        if (controller.signal.aborted) {
          resolve();
          return;
        }

        let settled = false;
        let timer = 0;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (timer) window.clearTimeout(timer);
          if (wakeRetry === finish) wakeRetry = null;
          controller.signal.removeEventListener("abort", finish);
          resolve();
        };
        timer = window.setTimeout(finish, milliseconds);
        wakeRetry = finish;
        controller.signal.addEventListener("abort", finish, { once: true });
      });
    const refresh = async (): Promise<StageSnapshot> => {
      if (refreshPromise) {
        refreshDirty = true;
        return refreshPromise;
      }

      const task = (async () => {
        let next: StageSnapshot;
        do {
          refreshDirty = false;
          next = await getLiveStageSnapshot(sessionId, controller.signal);
          if (!controller.signal.aborted) applySnapshot(next);
        } while (refreshDirty && !controller.signal.aborted);
        return next;
      })();

      refreshPromise = task;
      try {
        return await task;
      } finally {
        if (refreshPromise === task) refreshPromise = null;
      }
    };

    const scheduleLobbyRefresh = () => {
      if (lobbyRefreshTimer || controller.signal.aborted) return;
      lobbyRefreshTimer = window.setTimeout(() => {
        lobbyRefreshTimer = 0;
        void refresh().catch((error) => {
          if (!controller.signal.aborted) {
            setState((value) => ({ ...value, error: errorText(error) }));
          }
        });
      }, 350);
    };

    const handleEvent = async (event: LiveEvent) => {
      if (!shouldApplyLiveEvent(cursorRef.current, event)) return;

      if (event.name === "presence.updated") {
        cursorRef.current = advanceLiveCursor(cursorRef.current, event);
        const payload = eventRecord(event.payload);
        const participantDelta = Number(payload.participant_delta ?? 0);
        const activeParticipantDelta = Number(
          payload.active_participant_delta ?? 0,
        );
        const current = snapshotRef.current;
        if (
          current &&
          (participantDelta !== 0 || activeParticipantDelta !== 0)
        ) {
          const next = {
            ...current,
            participant_count: Math.max(
              0,
              current.participant_count + participantDelta,
            ),
            active_participant_count: Math.max(
              0,
              (current.active_participant_count ?? current.participant_count) +
                activeParticipantDelta,
            ),
          };
          snapshotRef.current = next;
          setState((value) => ({ ...value, snapshot: next }));
          if (current.session.state === "lobby" && participantDelta !== 0) {
            scheduleLobbyRefresh();
          }
        }
        return;
      }

      if (
        event.name === "session.created" ||
        event.name === "session.state_changed" ||
        event.name === "ranking.updated"
      ) {
        // Do not acknowledge a state transition until the Stage snapshot has
        // caught up. A failed refresh then tears down this stream and replay
        // resumes from the last fully applied cursor.
        await refresh();
        if (
          cursorRef.current.eventId < Number(event.event_id || 0) ||
          cursorRef.current.stateVersion < Number(event.state_version || 0)
        ) {
          throw new Error("stage_snapshot_behind_event");
        }
      }
    };

    const recoverIfReachable = () => {
      if (
        controller.signal.aborted ||
        (typeof navigator !== "undefined" && navigator.onLine === false)
      ) {
        return;
      }

      // Returning online/foreground should not sit behind an old exponential
      // backoff. Wake the retry loop and refresh the authoritative Stage
      // snapshot immediately; the SSE stream then resumes from that cursor.
      wakeRetry?.();
      if (snapshotRef.current) {
        void refresh().catch((error) => {
          if (!controller.signal.aborted && !isFatalStageError(error)) {
            setState((value) => ({
              ...value,
              isConnected: false,
              error: errorText(error),
            }));
          }
        });
      }
    };
    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") {
        recoverIfReachable();
      }
    };

    window.addEventListener("online", recoverIfReachable);
    window.addEventListener("pageshow", recoverIfReachable);
    document.addEventListener("visibilitychange", recoverWhenVisible);

    void (async () => {
      let retry = 500;

      while (!controller.signal.aborted && !snapshotRef.current) {
        try {
          await refresh();
          retry = 500;
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({
            snapshot: null,
            isConnected: false,
            isLoading: false,
            error: errorText(error),
          });
          if (isFatalStageError(error)) return;
          const retryAfterMs =
            error instanceof LiveAPIError ? error.retryAfterMs ?? 0 : 0;
          await waitForRetry(Math.max(retry, retryAfterMs));
          retry = Math.min(retry * 2, 10_000);
        }
      }

      let needsRecoverySnapshot = false;
      while (!controller.signal.aborted) {
        if (needsRecoverySnapshot) {
          try {
            await refresh();
            needsRecoverySnapshot = false;
          } catch (snapshotError) {
            if (controller.signal.aborted) return;
            setState((value) => ({
              ...value,
              isConnected: false,
              error: errorText(snapshotError),
            }));
            if (isFatalStageError(snapshotError)) return;
            const retryAfterMs =
              snapshotError instanceof LiveAPIError
                ? snapshotError.retryAfterMs ?? 0
                : 0;
            await waitForRetry(Math.max(retry, retryAfterMs));
            retry = Math.min(retry * 2, 10_000);
            continue;
          }
        }

        try {
          setState((value) => ({
            ...value,
            isConnected: false,
          }));
          await streamLiveEvents(sessionId, cursorRef.current.eventId, {
            signal: controller.signal,
            viewer: "stage",
            onOpen: () => {
              if (controller.signal.aborted) return;
              retry = 500;
              setState((value) => ({
                ...value,
                isConnected: true,
                error: null,
              }));
            },
            onEvent: handleEvent,
          });
          if (!controller.signal.aborted) {
            throw new Error("stage_event_stream_closed");
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setState((value) => ({
            ...value,
            isConnected: false,
            error: errorText(error),
          }));
          if (isFatalStageError(error)) return;

          needsRecoverySnapshot = true;
          const retryAfterMs =
            error instanceof LiveAPIError ? error.retryAfterMs ?? 0 : 0;
          await waitForRetry(Math.max(retry, retryAfterMs));
          retry = Math.min(retry * 2, 10_000);
        }
      }
    })();

    return () => {
      window.removeEventListener("online", recoverIfReachable);
      window.removeEventListener("pageshow", recoverIfReachable);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
      if (lobbyRefreshTimer) window.clearTimeout(lobbyRefreshTimer);
      wakeRetry?.();
      controller.abort();
    };
  }, [applySnapshot, sessionId]);

  return state;
}

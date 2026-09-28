import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearLegacyParticipantArtifacts,
  getPersistedUserIdForRoom,
  readStoredProfile,
  type StoredPlayerProfile,
} from "../model/playerProfileStorage.ts";
import {
  clearPlayerSeenActive,
  persistPlayerLastActive,
  persistPlayerSeenActive,
  readPlayerLastActive,
  readPlayerSeenActive,
  type PlayerLastActive,
} from "../model/presentationFlow.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import type { LiveSessionContextValue } from "../react/liveSessionContext.ts";

type UsePlayerSessionRecoveryOptions = {
  enabled: boolean;
  roomId?: string;
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  hasLeaderboard: boolean;
  isConnected: boolean;
  connect: LiveSessionContextValue["connect"];
  joinParticipant: LiveSessionContextValue["joinParticipant"];
};

type PlayerSessionRecovery = {
  hasSeenActiveSlide: boolean;
  lastActive: PlayerLastActive | null;
  profile: StoredPlayerProfile | null;
  shouldAutoResume: boolean;
};

export function usePlayerSessionRecovery({
  enabled,
  roomId,
  currentQuestion,
  currentContent,
  hasLeaderboard,
  isConnected,
  connect,
  joinParticipant,
}: UsePlayerSessionRecoveryOptions): PlayerSessionRecovery {
  const [hasSeenActiveSlide, setHasSeenActiveSlide] = useState(
    () => enabled && readPlayerSeenActive(roomId),
  );
  const [lastActive, setLastActive] = useState<PlayerLastActive | null>(
    () => (enabled ? readPlayerLastActive(roomId) : null),
  );
  const joinSentRef = useRef(false);
  const retryBlockedRef = useRef(false);
  const retryTimerRef = useRef(0);
  const [attempt, setAttempt] = useState(0);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = 0;
    }
    retryBlockedRef.current = false;
  }, []);

  const scheduleRetry = useCallback(
    (minimumDelay = 0) => {
      if (retryBlockedRef.current) return;
      retryBlockedRef.current = true;
      const baseDelay = Math.min(750 * 2 ** attempt, 10_000);
      const jitteredDelay = Math.round(
        baseDelay * (0.75 + Math.random() * 0.5),
      );
      const delay = Math.max(minimumDelay, jitteredDelay);

      retryTimerRef.current = window.setTimeout(() => {
        retryBlockedRef.current = false;
        setAttempt((value) => value + 1);
      }, delay);
    },
    [attempt],
  );

  const profile = useMemo(
    () => (enabled ? readStoredProfile(roomId) : null),
    [enabled, roomId],
  );

  useEffect(() => {
    if (enabled) clearLegacyParticipantArtifacts(roomId);
  }, [enabled, roomId]);

  useEffect(() => () => clearRetry(), [clearRetry]);

  useEffect(() => {
    if (!enabled) {
      setHasSeenActiveSlide(false);
      setLastActive(null);
      joinSentRef.current = false;
      setAttempt(0);
      clearRetry();
      return;
    }

    setHasSeenActiveSlide(readPlayerSeenActive(roomId));
    setLastActive(readPlayerLastActive(roomId));
    joinSentRef.current = false;
    setAttempt(0);
    clearRetry();
  }, [clearRetry, enabled, roomId]);

  useEffect(() => {
    if (!enabled) return;

    if (currentQuestion || currentContent) {
      setHasSeenActiveSlide(true);
      persistPlayerSeenActive(roomId);
    }

    if (currentQuestion) {
      const active: PlayerLastActive = {
        kind: "question",
        payload: currentQuestion,
        updatedAt: Date.now(),
      };
      setLastActive(active);
      persistPlayerLastActive(roomId, active);
      return;
    }

    if (currentContent) {
      const active: PlayerLastActive = {
        kind: "content",
        payload: currentContent,
        updatedAt: Date.now(),
      };
      setLastActive(active);
      persistPlayerLastActive(roomId, active);
    }
  }, [enabled, roomId, currentQuestion, currentContent]);

  const shouldAutoResume =
    enabled &&
    !!profile &&
    hasSeenActiveSlide &&
    !currentQuestion &&
    !currentContent &&
    !hasLeaderboard;

  useEffect(() => {
    if (!shouldAutoResume || !roomId || isConnected) return;
    if (retryBlockedRef.current) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      scheduleRetry(1500);
      return;
    }

    let cancelled = false;
    void connect(roomId)
      .then((ok) => {
        if (!cancelled && !ok) scheduleRetry();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[PresentationFlow] player resume connect failed:", error);
        scheduleRetry();
      });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    shouldAutoResume,
    roomId,
    isConnected,
    connect,
    scheduleRetry,
  ]);

  useEffect(() => {
    if (!shouldAutoResume || !isConnected || !profile) {
      joinSentRef.current = false;
      return;
    }

    if (joinSentRef.current || retryBlockedRef.current) return;
    joinSentRef.current = true;
    let cancelled = false;

    void joinParticipant({
      name: profile.name,
      avatar: profile.avatar,
      clientUserId: getPersistedUserIdForRoom(roomId) ?? undefined,
    }).then((outcome) => {
      if (cancelled) return;

      if (outcome === true) {
        clearRetry();
        setAttempt(0);
        return;
      }

      joinSentRef.current = false;
      if (
        typeof outcome === "object" &&
        outcome?.status === "rate_limited"
      ) {
        scheduleRetry(outcome.retryAfterMs);
        return;
      }

      if (outcome === "name_taken" || outcome === "rejected") {
        // The saved resume identity is no longer usable for this run. Drop only
        // the same-tab resume marker so the participant gets the editable join
        // UI instead of waiting forever behind an impossible auto-resume.
        clearRetry();
        clearPlayerSeenActive(roomId);
        setHasSeenActiveSlide(false);
        setLastActive(null);
        return;
      }

      scheduleRetry();
    });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    shouldAutoResume,
    isConnected,
    profile,
    roomId,
    joinParticipant,
    clearRetry,
    scheduleRetry,
  ]);

  return {
    hasSeenActiveSlide,
    lastActive,
    profile,
    shouldAutoResume,
  };
}

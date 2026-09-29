import { useEffect, useState } from "react";

import { getLiveSnapshot } from "../api/liveApi.ts";
import type { ActivityPhase } from "../api/types.ts";

type ManagerActivityProgressOptions = {
  enabled: boolean;
  sessionId?: string;
  activeItemId?: string | null;
  activityPhase?: ActivityPhase | null;
  fallbackCount?: number;
};

const POLL_INTERVAL_MS = 2_000;

export function useManagerActivityProgress({
  enabled,
  sessionId,
  activeItemId,
  activityPhase,
  fallbackCount = 0,
}: ManagerActivityProgressOptions): number {
  const [count, setCount] = useState(Math.max(0, fallbackCount));

  useEffect(() => {
    setCount(Math.max(0, fallbackCount));
  }, [activeItemId, fallbackCount, sessionId]);

  useEffect(() => {
    if (
      !enabled ||
      !sessionId ||
      !activeItemId ||
      activityPhase !== "accepting"
    ) {
      return;
    }

    let cancelled = false;
    let timer = 0;

    const poll = async () => {
      let shouldContinue = true;
      try {
        const fresh = await getLiveSnapshot(sessionId, { viewer: "manager" });
        if (
          fresh.role !== "manager" ||
          fresh.session.active_item_id !== activeItemId ||
          fresh.session.activity_phase !== "accepting"
        ) {
          shouldContinue = false;
        } else if (!cancelled) {
          setCount(Math.max(0, Number(fresh.active_activity_response_count ?? 0)));
        }
      } catch {
        // Progress is best-effort. The live runtime remains authoritative for
        // lifecycle state and the next bounded poll can recover the counter.
      }

      if (!cancelled && shouldContinue) {
        timer = window.setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [activeItemId, activityPhase, enabled, sessionId]);

  return count;
}

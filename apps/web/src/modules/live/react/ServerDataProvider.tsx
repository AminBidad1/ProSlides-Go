import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  LegacyLiveUser,
  ServerDataFields,
  ServerDataValue,
} from "../model/serverData.ts";
import { projectLiveSnapshot } from "../runtime/protocol.ts";
import { ServerDataContext } from "./serverDataContext.ts";
import { useLiveSession } from "./useLiveSession.ts";

const EMPTY_PROJECTION: ServerDataFields = {
  participantCount: 0,
  users: [],
  questionResults: null,
  leaderboardResults: null,
  managerLastLeaderboard: null,
  modalLeaderboardResults: null,
  currentQuestion: null,
  currentContent: null,
};

type ServerDataProviderProps = {
  children: ReactNode;
};

export function ServerDataProvider({
  children,
}: ServerDataProviderProps) {
  const { snapshot, roster, rosterOrder } = useLiveSession();
  const projection = useMemo(
    () => projectLiveSnapshot(snapshot, roster) ?? EMPTY_PROJECTION,
    [snapshot, roster],
  );
  const managerSessionId =
    snapshot?.role === "manager" ? snapshot.session.id : null;
  const [managerLeaderboardCache, setManagerLeaderboardCache] =
    useState<{ sessionId: string; rows: LegacyLiveUser[] } | null>(null);

  useEffect(() => {
    if (!managerSessionId) return;

    const rankedRows =
      projection.leaderboardResults &&
      projection.leaderboardResults.length > 0
        ? projection.leaderboardResults
        : rosterOrder === "score" && projection.users.length > 0
          ? projection.users
          : null;
    if (!rankedRows) return;

    setManagerLeaderboardCache({
      sessionId: managerSessionId,
      rows: rankedRows,
    });
  }, [
    managerSessionId,
    projection.leaderboardResults,
    projection.users,
    rosterOrder,
  ]);

  const managerLastLeaderboard =
    managerSessionId &&
    managerLeaderboardCache?.sessionId === managerSessionId
      ? managerLeaderboardCache.rows
      : null;

  const serverData = useMemo<ServerDataFields>(
    () => ({
      ...EMPTY_PROJECTION,
      ...projection,
      managerLastLeaderboard,
      modalLeaderboardResults:
        snapshot?.role === "manager" ? projection.users : null,
    }),
    [managerLastLeaderboard, projection, snapshot?.role],
  );

  const value = useMemo<ServerDataValue>(
    () => ({
      serverData,
      ...serverData,
    }),
    [serverData],
  );

  return (
    <ServerDataContext.Provider value={value}>
      {children}
    </ServerDataContext.Provider>
  );
}

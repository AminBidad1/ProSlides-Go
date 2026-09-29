import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createLiveRuntime,
  type LiveClientRole,
} from "../runtime/LiveRuntime.ts";
import { LiveSessionContext } from "./liveSessionContext.ts";

type LiveSessionProviderProps = {
  children: ReactNode;
  role?: LiveClientRole;
};

export function LiveSessionProvider({
  children,
  role = "manager",
}: LiveSessionProviderProps) {
  const runtime = useMemo(() => createLiveRuntime(role), [role]);
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.getState,
    runtime.getState,
  );

  useEffect(() => () => runtime.destroy(), [runtime]);

  useEffect(() => {
    const recoverIfReachable = () => {
      if (
        typeof navigator !== "undefined" &&
        navigator.onLine === false
      ) {
        return;
      }
      void runtime.resync();
    };
    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") {
        recoverIfReachable();
      }
    };

    window.addEventListener("online", recoverIfReachable);
    window.addEventListener("pageshow", recoverIfReachable);
    document.addEventListener("visibilitychange", recoverWhenVisible);
    return () => {
      window.removeEventListener("online", recoverIfReachable);
      window.removeEventListener("pageshow", recoverIfReachable);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
    };
  }, [runtime]);

  const value = useMemo(
    () => ({
      ...state,
      participantCount: state.snapshot?.participant_count ?? 0,
      connect: runtime.connect,
      disconnect: runtime.disconnect,
      resync: runtime.resync,
      joinParticipant: runtime.joinParticipant,
      submitAnswer: runtime.submitAnswer,
      sendNavigation: runtime.sendNavigation,
      sendManagerAction: runtime.sendManagerAction,
      moderateWordCloudTerm: runtime.moderateWordCloudTerm,
      sendEnd: runtime.sendEnd,
      loadRoster: runtime.loadRoster,
      loadMoreRoster: runtime.loadMoreRoster,
    }),
    [runtime, state],
  );

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}

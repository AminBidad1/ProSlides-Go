import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AudioProvider } from "../react/AudioProvider.tsx";
import Waiting from "../ui/WaitingScreen.tsx";
import {
  getLiveSnapshot,
  LiveAPIError,
  resolveLiveSession,
} from "../api/liveApi.ts";
import type { LiveSessionLocator } from "../api/types.ts";
import {
  clearAccessSessionRecovery,
  readAccessSessionRecovery,
  saveAccessSessionRecovery,
} from "../model/accessSessionRecovery.ts";
import type { LivePresentationModel } from "../model/presentation.ts";
import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import { LiveSessionProvider } from "../react/LiveSessionProvider.tsx";
import { ServerDataProvider } from "../react/ServerDataProvider.tsx";
import { AppPresentation } from "./PresentationFlow.tsx";

type PresentationEntryMode = "presentation" | "accessCode";

type PresentationEntryProps = {
  mode: PresentationEntryMode;
  role?: LiveClientRole;
};

type ResolveStatus = "loading" | "invalid" | "unavailable" | "success";

const toResolvedMeta = (
  accessCode: string,
  data: LiveSessionLocator,
): LivePresentationModel => ({
  quiz_id: data.presentation_id,
  title: data.presentation.title,
  access_code: accessCode,
  background: {
    color: data.presentation.background_color,
    image: data.presentation.background_image_url,
    text_color: data.presentation.text_color,
  },
  music_url: data.presentation.music_url || "",
  accent_color: data.presentation.accent_color,
  visualization_palette: data.presentation.visualization_palette,
  slides: [],
  text_color: data.presentation.text_color,
});

export default function PresentationEntry({
  mode,
  role,
}: PresentationEntryProps) {
  return mode === "accessCode" ? (
    <AccessCodeResolver />
  ) : (
    <PresentationRouter explicitRole={role} />
  );
}

function AccessCodeResolver() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [status, setStatus] = useState<ResolveStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [resolvedData, setResolvedData] =
    useState<LiveSessionLocator | null>(null);
  const [resolvedMeta, setResolvedMeta] =
    useState<LivePresentationModel | null>(null);

  useEffect(() => {
    let active = true;

    const resolveCode = async () => {
      setStatus("loading");
      if (!accessCode) {
        if (active) setStatus("invalid");
        return;
      }

      try {
        const data = await resolveLiveSession(accessCode);
        if (!active) return;

        if (!data.session_id) {
          setStatus("invalid");
          return;
        }

        saveAccessSessionRecovery(accessCode, data);
        setResolvedData(data);
        setResolvedMeta(toResolvedMeta(accessCode, data));
        setStatus("success");
      } catch (error) {
        if (!active) return;

        if (error instanceof LiveAPIError && error.status === 404) {
          const cached = readAccessSessionRecovery(accessCode);
          if (!cached) {
            setStatus("invalid");
            return;
          }

          try {
            const snapshot = await getLiveSnapshot(cached.session_id, {
              viewer: "participant",
            });
            if (!active) return;

            if (snapshot.role !== "participant") {
              clearAccessSessionRecovery(accessCode);
              setStatus("invalid");
              return;
            }

            setResolvedData(cached);
            setResolvedMeta(toResolvedMeta(accessCode, cached));
            setStatus("success");
            return;
          } catch (recoveryError) {
            if (!active) return;
            if (
              recoveryError instanceof LiveAPIError &&
              [401, 404].includes(recoveryError.status)
            ) {
              clearAccessSessionRecovery(accessCode);
              setStatus("invalid");
              return;
            }
            console.error(
              "[AccessCodeResolver] participant recovery failed:",
              recoveryError,
            );
            setStatus("unavailable");
            return;
          }
        }

        console.error("[AccessCodeResolver] Error:", error);
        setStatus("unavailable");
      }
    };

    void resolveCode();
    return () => {
      active = false;
    };
  }, [accessCode, attempt]);

  useEffect(() => {
    if (status !== "unavailable") return;
    const retryWhenOnline = () => setAttempt((value) => value + 1);
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [status]);

  if (status === "loading") {
    return <Waiting message="در حال ورود به کوئیز…" />;
  }

  if (status === "invalid") {
    return <Waiting message="کد ورود معتبر نیست" busy={false} />;
  }

  if (status === "unavailable") {
    return (
      <Waiting
        message="ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید."
        actionLabel="تلاش دوباره"
        onAction={() => setAttempt((value) => value + 1)}
        busy={false}
      />
    );
  }

  if (resolvedData && resolvedMeta) {
    return (
      <AudioProvider>
        <LiveSessionProvider
          key={`player:${resolvedData.session_id}`}
          role="player"
        >
          <ServerDataProvider>
            <AppPresentation
              sessionId={resolvedData.session_id}
              role="player"
              initialQuizData={resolvedMeta}
            />
          </ServerDataProvider>
        </LiveSessionProvider>
      </AudioProvider>
    );
  }

  return <Waiting message="در حال آماده‌سازی جلسه…" />;
}

function PresentationRouter({
  explicitRole,
}: {
  explicitRole?: LiveClientRole;
}) {
  const { presentationId, sessionId } = useParams<{
    presentationId?: string;
    sessionId?: string;
  }>();
  const role: LiveClientRole =
    explicitRole === "player" ? "player" : "manager";
  const identity = role === "manager" ? presentationId : sessionId;

  return (
    <AudioProvider>
      <LiveSessionProvider
        key={`${role}:${identity || "unknown"}`}
        role={role}
      >
        <ServerDataProvider>
          <AppPresentation
            presentationId={role === "manager" ? presentationId : undefined}
            sessionId={role === "player" ? sessionId : undefined}
            role={role}
          />
        </ServerDataProvider>
      </LiveSessionProvider>
    </AudioProvider>
  );
}

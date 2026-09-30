import { useEffect, useMemo, useState } from "react";

import type { LiveSnapshot } from "../api/types.ts";
import { getPresentationForLive } from "../api/presentationApi.ts";
import type {
  LivePresentationModel,
} from "../model/presentation.ts";
import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import { presentationSlideToLegacy } from "../runtime/protocol.ts";
import { EMPTY_PRESENTATION } from "../model/presentationFlow.ts";

type UseLivePresentationModelOptions = {
  presentationId?: string;
  role: LiveClientRole;
  initialQuizData?: LivePresentationModel | null;
  snapshot: LiveSnapshot | null;
};

type LivePresentationModelState = {
  remoteQuiz: LivePresentationModel | null;
  quiz: LivePresentationModel;
  isRemoteReady: boolean;
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const focalValue = (value: unknown): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1
    ? value
    : 0.5;

export const toLivePresentationModel = (
  presentation: Awaited<ReturnType<typeof getPresentationForLive>>,
): LivePresentationModel => {
  const settings = presentation.settings ?? {};
  const textColor = stringValue(settings.text_color, "#111827");
  const accentColor = stringValue(settings.accent_color, "#8b5cf6");
  const visualizationPalette = Array.isArray(settings.visualization_palette)
    ? settings.visualization_palette.filter(
        (color): color is string => typeof color === "string",
      )
    : ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];

  return {
    quiz_id: presentation.id,
    title: presentation.title,
    access_code: presentation.access_code || "",
    background: {
      color: stringValue(settings.background_color, "#1e1e2e"),
      image: stringValue(settings.background_image_url),
      focal_x: focalValue(settings.background_image_focal_x),
      focal_y: focalValue(settings.background_image_focal_y),
      text_color: textColor,
    },
    music_url: stringValue(settings.music_url),
    accent_color: accentColor,
    visualization_palette: visualizationPalette,
    slides: Array.isArray(presentation.slides)
      ? presentation.slides.map(presentationSlideToLegacy)
      : [],
    text_color: textColor,
  };
};

export const projectManagerLivePresentation = (
  baseQuiz: LivePresentationModel,
  snapshot: Extract<LiveSnapshot, { role: "manager" }>,
): LivePresentationModel => {
  const frozenSlides = Array.isArray(snapshot.items)
    ? snapshot.items.map(presentationSlideToLegacy)
    : null;

  return {
    ...baseQuiz,
    title: snapshot.presentation.title,
    access_code: snapshot.session.join_code,
    background: {
      color: snapshot.presentation.background_color,
      image: snapshot.presentation.background_image_url,
      focal_x: focalValue(
        snapshot.presentation.background_image_focal_x,
      ),
      focal_y: focalValue(
        snapshot.presentation.background_image_focal_y,
      ),
      text_color: snapshot.presentation.text_color,
    },
    music_url: snapshot.presentation.music_url,
    accent_color: snapshot.presentation.accent_color,
    visualization_palette: snapshot.presentation.visualization_palette,
    slides: frozenSlides ?? baseQuiz.slides,
    text_color: snapshot.presentation.text_color,
  };
};

export const isLivePresentationDefinitionReady = ({
  role,
  remoteQuiz,
  snapshot,
}: {
  role: LiveClientRole;
  remoteQuiz: LivePresentationModel | null;
  snapshot: LiveSnapshot | null;
}): boolean =>
  role === "player" ||
  remoteQuiz !== null ||
  (snapshot?.role === "manager" && Array.isArray(snapshot.items));

export function useLivePresentationModel({
  presentationId,
  role,
  initialQuizData = null,
  snapshot,
}: UseLivePresentationModelOptions): LivePresentationModelState {
  const [remoteQuiz, setRemoteQuiz] =
    useState<LivePresentationModel | null>(initialQuizData);

  useEffect(() => {
    if (role !== "player" || !initialQuizData) return;
    setRemoteQuiz((current) => current ?? initialQuizData);
  }, [initialQuizData, role]);

  useEffect(() => {
    if (role !== "manager" || !presentationId) return;
    if (snapshot?.role === "manager" && Array.isArray(snapshot.items)) return;

    let stopped = false;
    let activeController: AbortController | null = null;
    let retryTimer = 0;
    let wakeRetry: (() => void) | null = null;
    let reported = false;

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        wakeRetry = resolve;
        retryTimer = window.setTimeout(() => {
          retryTimer = 0;
          wakeRetry = null;
          resolve();
        }, milliseconds);
      });

    void (async () => {
      let retry = 750;
      while (!stopped) {
        const controller = new AbortController();
        activeController = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15_000);

        try {
          const presentation = await getPresentationForLive(
            presentationId,
            controller.signal,
          );
          if (!stopped) {
            setRemoteQuiz(toLivePresentationModel(presentation));
          }
          return;
        } catch (error: unknown) {
          if (stopped) return;
          if (!reported) {
            reported = true;
            console.error(
              "[PresentationFlow] could not load presentation; retrying",
              error,
            );
          }
        } finally {
          window.clearTimeout(timeout);
          if (activeController === controller) activeController = null;
        }

        await wait(retry);
        retry = Math.min(retry * 2, 10_000);
      }
    })();

    return () => {
      stopped = true;
      activeController?.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      wakeRetry?.();
    };
  }, [role, presentationId, snapshot]);

  const quiz = useMemo<LivePresentationModel>(() => {
    const baseQuiz = remoteQuiz ?? EMPTY_PRESENTATION;
    if (snapshot?.role !== "manager") return baseQuiz;
    return projectManagerLivePresentation(baseQuiz, snapshot);
  }, [remoteQuiz, snapshot]);

  return {
    remoteQuiz,
    quiz,
    isRemoteReady: isLivePresentationDefinitionReady({
      role,
      remoteQuiz,
      snapshot,
    }),
  };
}

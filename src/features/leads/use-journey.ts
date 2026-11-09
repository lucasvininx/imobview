"use client";
import { useEffect, useRef, useCallback } from "react";
import type { z } from "zod";
import type { eventSchema } from "./schema";
import { TourEngagement, TOUR_HEARTBEAT_MS } from "./engagement";
import {
  financingInputSchema,
  type FinancingInput,
} from "@/features/financing/calc";
type Kind = z.infer<typeof eventSchema>["kind"];
// Other components report interactions without access to the visit token.
export type JourneyInteraction =
  "CONTACT" | "SHARE" | { kind: "SIMULATE"; simulation: FinancingInput };
export function reportInteraction(detail: JourneyInteraction) {
  window.dispatchEvent(new CustomEvent("imobview-interaction", { detail }));
}
export function useJourney(
  token: string | null,
  enabled: boolean,
  sceneCount: number,
) {
  const tourRef = useRef<HTMLDivElement>(null);
  const attachTour = useCallback((element: HTMLDivElement | null) => {
    tourRef.current = element;
  }, []);
  const clock = useRef(new TourEngagement(sceneCount));
  const state = useRef({
    sequence: 0,
    scene: null as string | null,
    started: false,
    complete: false,
    queue: Promise.resolve(),
  });
  const emit = useCallback(
    (
      kind: Kind,
      sceneId: string | null = null,
      durationMs = 0,
      simulation?: FinancingInput,
    ) => {
      if (!token || !enabled) return;
      const event = {
        sequence: ++state.current.sequence,
        kind,
        sceneId,
        durationMs: Math.min(30000, Math.max(0, Math.round(durationMs))),
        ...(simulation ? { simulation } : {}),
      };
      const body = JSON.stringify({ token, event });
      // Serialize requests and reuse sequence on retries; the server deduplicates them.
      state.current.queue = state.current.queue.then(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetch("/api/journey", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true,
            });
            if (response.ok) return;
          } catch {}
        }
      });
    },
    [token, enabled],
  );
  const flush = useCallback(() => {
    const s = state.current;
    const duration = clock.current.consume(performance.now());
    if (s.started && s.scene && duration) emit("HEARTBEAT", s.scene, duration);
    if (s.started && !s.complete && clock.current.complete) {
      emit("COMPLETE");
      s.complete = true;
    }
  }, [emit]);
  useEffect(() => {
    if (!token || !enabled) return;
    clock.current = new TourEngagement(sceneCount);
    state.current = {
      sequence: 0,
      scene: null,
      started: false,
      complete: false,
      queue: Promise.resolve(),
    };
    let inViewport = false;
    let focused = document.hasFocus();
    const updateActive = () => {
      flush();
      clock.current.setActive(
        inViewport && focused && document.visibilityState === "visible",
        performance.now(),
      );
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        updateActive();
      },
      { threshold: [0, 0.2] },
    );
    if (tourRef.current) observer.observe(tourRef.current);
    const activity = () => {
      clock.current.activity(performance.now());
    };
    const focus = () => {
      focused = true;
      activity();
      updateActive();
    };
    const blur = () => {
      focused = false;
      updateActive();
    };
    const interval = setInterval(flush, TOUR_HEARTBEAT_MS);
    const visibility = () => {
      updateActive();
    };
    const exit = () => {
      if (!state.current.started) return;
      flush();
      emit("EXIT", state.current.scene);
      state.current.started = false;
      clock.current.setActive(false, performance.now());
    };
    const interaction = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (detail === "CONTACT" || detail === "SHARE") emit(detail);
      else if (
        detail &&
        typeof detail === "object" &&
        "kind" in detail &&
        detail.kind === "SIMULATE" &&
        "simulation" in detail
      ) {
        const simulation = financingInputSchema.safeParse(detail.simulation);
        if (simulation.success) emit("SIMULATE", null, 0, simulation.data);
      }
    };
    const contact = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('a[href^="https://wa.me/"], a[href^="mailto:"]')
      )
        emit("CONTACT");
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    const element = tourRef.current;
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
    ] as const;
    for (const kind of activityEvents)
      element?.addEventListener(kind, activity, { passive: true });
    window.addEventListener("pagehide", exit);
    window.addEventListener("imobview-interaction", interaction);
    document.addEventListener("click", contact);
    return () => {
      exit();
      observer.disconnect();
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
      for (const kind of activityEvents)
        element?.removeEventListener(kind, activity);
      document.removeEventListener("click", contact);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", exit);
      window.removeEventListener("imobview-interaction", interaction);
    };
  }, [token, enabled, sceneCount, flush, emit]);
  const sceneChanged = useCallback(
    (id: string) => {
      const s = state.current;
      if (!s.started) {
        emit("START");
        s.started = true;
      }
      flush();
      s.scene = id;
      clock.current.setScene(id, performance.now());
      emit("SCENE", id);
    },
    [emit, flush],
  );
  return {
    attachTour,
    sceneChanged,
    hotspot: () => emit("HOTSPOT", state.current.scene),
    detail: (sceneId: string) => emit("DETAIL", sceneId),
    stop: () => {
      if (!state.current.started) return;
      flush();
      emit("EXIT", state.current.scene);
      state.current.started = false;
      clock.current.setActive(false, performance.now());
    },
  };
}

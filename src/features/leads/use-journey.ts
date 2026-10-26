"use client";
import { useEffect, useRef, useCallback } from "react";
import type { z } from "zod";
import type { eventSchema } from "./schema";
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
  const state = useRef({
    sequence: 0,
    scene: null as string | null,
    since: 0,
    started: false,
    complete: false,
    visited: new Set<string>(),
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
    if (s.started && s.scene && s.since)
      emit("HEARTBEAT", s.scene, performance.now() - s.since);
    s.since = document.visibilityState === "visible" ? performance.now() : 0;
  }, [emit]);
  useEffect(() => {
    state.current = {
      sequence: 0,
      scene: null,
      since: 0,
      started: false,
      complete: false,
      visited: new Set(),
      queue: Promise.resolve(),
    };
    const interval = setInterval(flush, 10000);
    const visibility = () => {
      flush();
    };
    const exit = () => {
      flush();
      emit("EXIT", state.current.scene);
      state.current.started = false;
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
    window.addEventListener("pagehide", exit);
    window.addEventListener("imobview-interaction", interaction);
    document.addEventListener("click", contact);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", contact);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", exit);
      window.removeEventListener("imobview-interaction", interaction);
    };
  }, [token, enabled, flush, emit]);
  const sceneChanged = useCallback(
    (id: string) => {
      const s = state.current;
      if (!s.started) {
        emit("START");
        s.started = true;
      }
      flush();
      s.scene = id;
      s.since = document.visibilityState === "visible" ? performance.now() : 0;
      emit("SCENE", id);
      s.visited.add(id);
      if (s.visited.size === sceneCount && !s.complete) {
        emit("COMPLETE");
        s.complete = true;
      }
    },
    [emit, flush, sceneCount],
  );
  return {
    sceneChanged,
    hotspot: () => emit("HOTSPOT", state.current.scene),
    detail: (sceneId: string) => emit("DETAIL", sceneId),
    stop: () => {
      flush();
      emit("EXIT", state.current.scene);
    },
  };
}

"use client";
import { useEffect, useRef, useCallback } from "react";
import type { z } from "zod";
import type { eventSchema } from "./schema";
type Kind = z.infer<typeof eventSchema>["kind"];
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
    (kind: Kind, sceneId: string | null = null, durationMs = 0) => {
      if (!token || !enabled) return;
      const event = {
        sequence: ++state.current.sequence,
        kind,
        sceneId,
        durationMs: Math.min(30000, Math.max(0, Math.round(durationMs))),
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
      if (
        event instanceof CustomEvent &&
        (event.detail === "CONTACT" || event.detail === "SHARE")
      )
        emit(event.detail);
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
    stop: () => {
      flush();
      emit("EXIT", state.current.scene);
    },
  };
}

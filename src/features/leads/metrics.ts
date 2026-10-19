export type MeasuredEvent = {
  kind: string;
  sceneId: string | null;
  durationMs: number;
};
export function summarizeVisit(events: MeasuredEvent[]) {
  const rooms: Record<string, { visits: number; durationMs: number }> = {};
  let durationMs = 0;
  for (const event of events) {
    durationMs += event.durationMs;
    if (!event.sceneId) continue;
    const room = (rooms[event.sceneId] ??= { visits: 0, durationMs: 0 });
    room.durationMs += event.durationMs;
    if (event.kind === "SCENE") room.visits++;
  }
  return {
    durationMs,
    rooms,
    revisits: Object.values(rooms).reduce(
      (n, r) => n + Math.max(0, r.visits - 1),
      0,
    ),
  };
}
export function durationLabel(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

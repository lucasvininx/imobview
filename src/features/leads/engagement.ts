// Shared by measurement, server aggregation and the explanation shown to brokers.
export const MIN_ROOM_ENGAGEMENT_MS = 15000;
export const TOUR_IDLE_TIMEOUT_MS = 60000;
export const TOUR_HEARTBEAT_MS = 5000;

export class TourEngagement {
  scene: string | null = null;
  private since = 0;
  private lastInput = 0;
  private active = false;
  readonly rooms = new Map<string, number>();

  constructor(private sceneCount: number) {}

  activity(now: number) {
    // Resume from the interaction, never include the preceding idle period.
    if (now - this.lastInput >= TOUR_IDLE_TIMEOUT_MS) this.since = now;
    this.lastInput = now;
  }

  setActive(active: boolean, now: number) {
    if (active && !this.active) this.activity(now);
    this.active = active;
    this.since = now;
  }

  setScene(scene: string, now: number) {
    this.scene = scene;
    this.since = now;
    this.activity(now);
  }

  consume(now: number) {
    const end = Math.min(now, this.lastInput + TOUR_IDLE_TIMEOUT_MS);
    const duration =
      this.active && this.scene
        ? Math.round(Math.min(30000, Math.max(0, end - this.since)))
        : 0;
    this.since = now;
    if (this.scene && duration)
      this.rooms.set(this.scene, (this.rooms.get(this.scene) ?? 0) + duration);
    return duration;
  }

  get complete() {
    return (
      this.sceneCount > 0 &&
      [...this.rooms.values()].filter(
        (duration) => duration >= MIN_ROOM_ENGAGEMENT_MS,
      ).length >= this.sceneCount
    );
  }
}

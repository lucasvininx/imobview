import type { Amenity, ExteriorConfig, Facade } from "./schema";
import { localInstant, sunDirection, sunPosition } from "./sun";

// Scene axes: x east, y up, z south (north is -z). Units: metres.
export const FLOOR_HEIGHT = 3;
export const TOWER_SIZE = 16;
export type Box = {
  min: [number, number, number];
  max: [number, number, number];
};
export type Tower = Box & { index: number; floors: number };
export type Placed = { kind: Amenity; box: Box };

const towerCentres: Record<number, [number, number][]> = {
  1: [[0, -10]],
  2: [
    [-15, -10],
    [15, -10],
  ],
  3: [
    [-24, -10],
    [0, -10],
    [24, -10],
  ],
  4: [
    [-15, -26],
    [15, -26],
    [-15, -2],
    [15, -2],
  ],
};
export const normals = {
  N: [0, 0, -1],
  S: [0, 0, 1],
  E: [1, 0, 0],
  W: [-1, 0, 0],
} as const satisfies Record<Facade, readonly [number, number, number]>;

// Deterministic pseudo-random numbers so a property always shows the same neighbourhood.
function random(seed: number) {
  let state = Math.floor(Math.abs(seed) * 1e6) % 2147483647 || 1;
  return () => (state = (state * 48271) % 2147483647) / 2147483647;
}

export function buildLayout(config: ExteriorConfig) {
  const towers: Tower[] = towerCentres[config.towers].map(([x, z], i) => ({
    index: i + 1,
    floors: config.floors,
    min: [x - TOWER_SIZE / 2, 0, z - TOWER_SIZE / 2],
    max: [
      x + TOWER_SIZE / 2,
      config.floors * FLOOR_HEIGHT + 1.5,
      z + TOWER_SIZE / 2,
    ],
  }));
  const tower = towers[config.unitTower - 1];
  const centre = [
    (tower.min[0] + tower.max[0]) / 2,
    (tower.min[2] + tower.max[2]) / 2,
  ];
  const normal = normals[config.unitFacade];
  const half = TOWER_SIZE / 2;
  const y = config.unitFloor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
  // Apartment: 8 m wide, one floor high, on the chosen facade.
  const unitCentre: [number, number, number] = [
    centre[0] + normal[0] * half,
    y,
    centre[1] + normal[2] * half,
  ];
  const across = normal[0] === 0 ? [4, 0] : [0, 4];
  const unit: Box = {
    min: [
      unitCentre[0] - across[0] - Math.max(0, -normal[0]) * 0.4,
      y - FLOOR_HEIGHT / 2 + 0.1,
      unitCentre[2] - across[1] - Math.max(0, -normal[2]) * 0.4,
    ],
    max: [
      unitCentre[0] + across[0] + Math.max(0, normal[0]) * 0.4,
      y + FLOOR_HEIGHT / 2 - 0.1,
      unitCentre[2] + across[1] + Math.max(0, normal[2]) * 0.4,
    ],
  };
  const slots: [number, number][] = [
    [-26, 24],
    [-6, 24],
    [14, 24],
    [30, 24],
  ];
  const sizes: Record<Amenity, [number, number]> = {
    pool: [14, 7],
    court: [12, 18],
    playground: [9, 9],
    garden: [10, 10],
  };
  const placed: Placed[] = config.amenities.map((kind, i) => {
    const [x, z] = slots[i];
    const [w, d] = sizes[kind];
    return {
      kind,
      box: { min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, 0.3, z + d / 2] },
    };
  });
  // Neighbouring blocks beyond the surrounding streets (illustrative).
  const next = random(config.latitude * 7.13 + config.longitude * 3.71);
  const neighbours: Box[] = [];
  for (let gx = -2; gx <= 2; gx++)
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.max(Math.abs(gx), Math.abs(gz)) !== 2 && (gx || gz)) continue;
      if (!gx && !gz) continue;
      const bx = gx * 48,
        bz = gz * 48;
      for (let k = 0; k < 2; k++) {
        const w = 10 + next() * 12,
          d = 10 + next() * 12;
        const x = bx + (next() - 0.5) * 18,
          z = bz + (next() - 0.5) * 18;
        const h = next() < 0.6 ? 6 + next() * 12 : 20 + next() * 45;
        neighbours.push({
          min: [x - w / 2, 0, z - d / 2],
          max: [x + w / 2, h, z + d / 2],
        });
      }
    }
  // Across the streets on the four sides (the lot spans about ±42 m).
  for (const side of [-1, 1])
    for (const along of [-1, 0, 1])
      for (const axis of [0, 1]) {
        const w = 12 + next() * 10,
          d = 12 + next() * 10,
          h = 8 + next() * 34;
        const a = side * 72 + (next() - 0.5) * 6;
        const b = along * 40 + (next() - 0.5) * 8;
        const [x, z] = axis ? [b, a] : [a, b];
        neighbours.push({
          min: [x - w / 2, 0, z - d / 2],
          max: [x + w / 2, h, z + d / 2],
        });
      }
  return { towers, unit, unitCentre, normal, placed, neighbours };
}
export type Layout = ReturnType<typeof buildLayout>;

function rayHitsBox(
  o: readonly number[],
  d: readonly number[],
  box: Box,
): boolean {
  let near = 0;
  let far = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < box.min[a] || o[a] > box.max[a]) return false;
      continue;
    }
    const t1 = (box.min[a] - o[a]) / d[a];
    const t2 = (box.max[a] - o[a]) / d[a];
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return false;
  }
  return far > 0;
}

export type FacadeSun = "night" | "behind" | "shaded" | "sun";
// Whether direct sunlight reaches the apartment facade at an instant.
export function facadeSun(
  layout: Layout,
  instant: Date,
  config: ExteriorConfig,
): FacadeSun {
  const sun = sunPosition(instant, config.latitude, config.longitude);
  if (sun.altitude <= 0) return "night";
  const d = sunDirection(sun);
  const dir = [d.x, d.y, d.z];
  if (dir[0] * layout.normal[0] + dir[2] * layout.normal[2] <= 0.02)
    return "behind";
  const o = layout.unitCentre.map((v, i) => v + layout.normal[i] * 0.6);
  const own = layout.towers[config.unitTower - 1];
  const blockers = [
    ...layout.towers.filter((t) => t !== own),
    ...layout.neighbours,
  ];
  return blockers.some((box) => rayHitsBox(o, dir, box)) ? "shaded" : "sun";
}

// Direct-sun intervals on the facade for a local date, sampled every 5 minutes.
export function dailySun(layout: Layout, config: ExteriorConfig, date: string) {
  const step = 5;
  const intervals: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (let minutes = 0; minutes <= 24 * 60; minutes += step) {
    const lit =
      minutes < 24 * 60 &&
      facadeSun(
        layout,
        localInstant(date, minutes, config.utcOffset),
        config,
      ) === "sun";
    if (lit && start === null) start = minutes;
    if (!lit && start !== null) {
      intervals.push({ start, end: minutes });
      start = null;
    }
  }
  return {
    intervals,
    minutes: intervals.reduce((total, i) => total + i.end - i.start, 0),
  };
}

export function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${m ? String(m).padStart(2, "0") : ""}`;
}
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m
    ? `${h}h${String(m).padStart(2, "0")}`
    : h
      ? `${h}h`
      : `${m} min`;
}

import { it, expect } from "vitest";
import { localInstant, sunPosition } from "@/features/exterior/sun";
import { buildLayout, dailySun, facadeSun } from "@/features/exterior/layout";
import {
  exteriorSchema,
  parseCoordinates,
  type ExteriorConfig,
} from "@/features/exterior/schema";

const deg = (rad: number) => (rad * 180) / Math.PI;
const SP = { latitude: -23.55, longitude: -46.63 };
const base: ExteriorConfig = {
  enabled: true,
  buildingName: "",
  ...SP,
  utcOffset: -3,
  towers: 1,
  floors: 20,
  unitTower: 1,
  unitFloor: 10,
  unitFacade: "N",
  amenities: [],
};

it("places the winter noon sun low in the north of São Paulo", () => {
  const sun = sunPosition(
    localInstant("2026-06-21", 12 * 60 + 8, -3),
    SP.latitude,
    SP.longitude,
  );
  // 90° - 23.55° (latitude) - 23.44° (solstice declination) ≈ 43°.
  expect(deg(sun.altitude)).toBeGreaterThan(42);
  expect(deg(sun.altitude)).toBeLessThan(44);
  const azimuth = deg(sun.azimuth);
  expect(Math.min(azimuth, 360 - azimuth)).toBeLessThan(3);
});

it("rises in the east at the equinox and sets in the west", () => {
  const morning = sunPosition(
    localInstant("2026-03-20", 6 * 60 + 30, -3),
    SP.latitude,
    SP.longitude,
  );
  const evening = sunPosition(
    localInstant("2026-03-20", 18 * 60 + 15, -3),
    SP.latitude,
    SP.longitude,
  );
  expect(deg(morning.azimuth)).toBeGreaterThan(80);
  expect(deg(morning.azimuth)).toBeLessThan(100);
  expect(deg(evening.azimuth)).toBeGreaterThan(260);
  expect(deg(evening.azimuth)).toBeLessThan(280);
  expect(
    sunPosition(localInstant("2026-03-20", 0, -3), SP.latitude, SP.longitude)
      .altitude,
  ).toBeLessThan(0);
});

it("gives a north facade in São Paulo much more winter sun than a south facade", () => {
  const north = dailySun(buildLayout(base), base, "2026-06-21");
  const southConfig = { ...base, unitFacade: "S" as const };
  const south = dailySun(buildLayout(southConfig), southConfig, "2026-06-21");
  expect(north.minutes).toBeGreaterThan(8 * 60);
  expect(south.minutes).toBe(0);
  const east = { ...base, unitFacade: "E" as const };
  const eastSun = dailySun(buildLayout(east), east, "2026-03-20");
  // Morning sun only: the facade loses the sun around solar noon.
  expect(eastSun.intervals[0].start).toBeLessThan(7 * 60);
  expect(eastSun.intervals.at(-1)!.end).toBeLessThanOrEqual(12 * 60 + 15);
});

it("accounts for shade from another tower of the condominium", () => {
  // Tower 1 at west faces east towards tower 2; a low unit is shaded in the early morning.
  const config = {
    ...base,
    towers: 2,
    unitTower: 1,
    unitFloor: 2,
    unitFacade: "E" as const,
  };
  const layout = buildLayout(config);
  expect(
    facadeSun(layout, localInstant("2026-03-20", 7 * 60, -3), config),
  ).toBe("shaded");
  expect(
    facadeSun(layout, localInstant("2026-03-20", 2 * 60, -3), config),
  ).toBe("night");
  expect(
    facadeSun(layout, localInstant("2026-03-20", 16 * 60, -3), config),
  ).toBe("behind");
});

it("validates the apartment against the building and reads pasted coordinates", () => {
  expect(exteriorSchema.safeParse(base).success).toBe(true);
  expect(exteriorSchema.safeParse({ ...base, unitFloor: 21 }).success).toBe(
    false,
  );
  expect(exteriorSchema.safeParse({ ...base, unitTower: 2 }).success).toBe(
    false,
  );
  expect(exteriorSchema.safeParse({ ...base, utcOffset: 2 }).success).toBe(
    false,
  );
  expect(
    exteriorSchema.safeParse({ ...base, amenities: ["pool", "pool"] }).success,
  ).toBe(false);
  expect(parseCoordinates("-23.5613, -46.6565")).toEqual({
    latitude: -23.5613,
    longitude: -46.6565,
  });
  expect(parseCoordinates("-23,5613; -46,6565")).toEqual({
    latitude: -23.5613,
    longitude: -46.6565,
  });
  expect(parseCoordinates("Av. Paulista, 1000")).toBeNull();
  expect(parseCoordinates("95, 10")).toBeNull();
});

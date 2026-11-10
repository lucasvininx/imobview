import { expect, it } from "vitest";
import { apartmentDoorways } from "../../scripts/apartment-demo-layout";

it("connects all rooms with a return path and routes gourmet through the balcony", () => {
  const visited = new Set<number>();
  function visit(room: number) {
    if (visited.has(room)) return;
    visited.add(room);
    apartmentDoorways
      .filter((link) => link.from === room)
      .forEach((link) => visit(link.to));
  }
  visit(0);
  expect(visited.size).toBe(8);
  for (const link of apartmentDoorways) {
    expect(
      apartmentDoorways.some(
        (back) => back.from === link.to && back.to === link.from,
      ),
    ).toBe(true);
    expect(Math.abs(link.pitch)).toBeLessThan(Math.PI / 2);
  }
  expect(
    apartmentDoorways.filter((link) => link.from === 2).map((link) => link.to),
  ).toEqual([3]);
  expect(
    apartmentDoorways.find((link) => link.from === 0 && link.to === 1)?.yaw,
  ).toBeGreaterThan(2);
});

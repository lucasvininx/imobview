import { expect, it } from "vitest";
import { TourEngagement } from "@/features/leads/engagement";

it("requires 15 seconds in every room rather than merely opening all rooms", () => {
  const clock = new TourEngagement(2);
  clock.setActive(true, 0);
  clock.setScene("a", 0);
  expect(clock.consume(5000)).toBe(5000);
  clock.setScene("b", 5000);
  clock.consume(10000);
  expect(clock.complete).toBe(false);
  clock.setScene("a", 10000);
  clock.consume(20000);
  expect(clock.complete).toBe(false);
  clock.setScene("b", 20000);
  clock.consume(30000);
  expect(clock.complete).toBe(true);
});

it("excludes time while the tour is hidden, outside the viewport or unfocused", () => {
  const clock = new TourEngagement(1);
  clock.setActive(true, 0);
  clock.setScene("a", 0);
  expect(clock.consume(5000)).toBe(5000);
  clock.setActive(false, 5000);
  expect(clock.consume(95000)).toBe(0);
  clock.setActive(true, 95000);
  expect(clock.consume(100000)).toBe(5000);
  expect(clock.rooms.get("a")).toBe(10000);
  expect(clock.complete).toBe(false);
});

it("stops after a minute of inactivity and resumes without including the idle gap", () => {
  const clock = new TourEngagement(1);
  clock.setActive(true, 0);
  clock.setScene("a", 0);
  for (let time = 5000; time <= 90000; time += 5000) clock.consume(time);
  expect(clock.rooms.get("a")).toBe(60000);
  clock.activity(92000);
  expect(clock.consume(95000)).toBe(3000);
  expect(clock.rooms.get("a")).toBe(63000);
});

it("does not complete an empty tour or count time without a scene", () => {
  const clock = new TourEngagement(0);
  clock.setActive(true, 0);
  expect(clock.consume(5000)).toBe(0);
  expect(clock.complete).toBe(false);
});

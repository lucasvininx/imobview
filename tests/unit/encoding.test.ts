import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("keeps the Tailwind stylesheet free of a BOM that breaks the production CSS parser", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  expect(css.charCodeAt(0)).not.toBe(0xfeff);
});

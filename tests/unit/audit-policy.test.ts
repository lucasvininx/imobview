import { it, expect } from "vitest";
import { auditBlockers } from "../../scripts/audit-policy.mjs";
const now = Date.UTC(2026, 9, 19);
const known = {
  vulnerabilities: {
    braces: {
      severity: "high",
      via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }],
    },
    micromatch: { severity: "high", via: ["braces"] },
  },
};
it("limits the exception to the known development dependency and expires it", () => {
  expect(auditBlockers(known, false, now)).toEqual([]);
  expect(auditBlockers(known, true, now)).toEqual(["braces", "micromatch"]);
  expect(auditBlockers(known, false, Date.UTC(2026, 10, 19))).toEqual([
    "braces",
    "micromatch",
  ]);
  expect(
    auditBlockers(
      {
        vulnerabilities: {
          braces: { severity: "high", via: [{ url: "unknown-advisory" }] },
        },
      },
      false,
      now,
    ),
  ).toEqual(["braces"]);
});

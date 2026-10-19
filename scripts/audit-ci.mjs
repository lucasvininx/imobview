import { spawnSync } from "node:child_process";
import { auditBlockers } from "./audit-policy.mjs";
if (!process.env.npm_execpath) throw new Error("Run through npm run audit:ci");
for (const production of [true, false]) {
  const result = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "audit",
      "--json",
      ...(production ? ["--omit=dev"] : []),
    ],
    { encoding: "utf8", windowsHide: true },
  );
  let report;
  try {
    report = JSON.parse(result.stdout);
    if (report.error || !report.metadata)
      throw new Error("Invalid audit response");
  } catch {
    throw new Error("Audit unavailable; failing closed.");
  }
  const blockers = auditBlockers(report, production);
  if (blockers.length) {
    process.stderr.write(`Security audit blocked: ${blockers.join(", ")}\n`);
    process.exitCode = 1;
  } else
    process.stdout.write(
      `${production ? "Production" : "Full dependency"} audit policy passed.\n`,
    );
  if (!production && report.vulnerabilities?.braces)
    process.stdout.write(
      "Known development-only braces advisory requires upstream fix; exception expires 2026-11-19. See docs/jornada-comercial.md.\n",
    );
}

const knownDevChain = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);
const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
export function auditBlockers(report, production = false, now = Date.now()) {
  const vulnerabilities = report.vulnerabilities ?? {};
  function excepted(name, seen = new Set()) {
    if (
      production ||
      now >= Date.UTC(2026, 10, 19) ||
      !knownDevChain.has(name) ||
      seen.has(name)
    )
      return false;
    seen.add(name);
    const item = vulnerabilities[name];
    return (
      !!item &&
      item.via.length > 0 &&
      item.via.every((v) =>
        typeof v === "string" ? excepted(v, new Set(seen)) : v.url === advisory,
      )
    );
  }
  return Object.entries(vulnerabilities)
    .filter(
      ([name, v]) =>
        ["high", "critical"].includes(v.severity) && !excepted(name),
    )
    .map(([name]) => name);
}

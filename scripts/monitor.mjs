import "dotenv/config";
const endpoint = new URL(
  "/api/health",
  process.env.OPERATIONS_MONITOR_URL || process.env.NEXT_PUBLIC_APP_URL,
);
try {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("unhealthy");
  const body = await response.json();
  if (body.status !== "ok") throw new Error("invalid-response");
  process.stdout.write(
    JSON.stringify({
      event: "health.ok",
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
} catch {
  process.stderr.write(
    JSON.stringify({
      event: "health.failed",
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
  process.exitCode = 1;
}

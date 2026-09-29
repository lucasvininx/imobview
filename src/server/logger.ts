export function logError(event: string, error: unknown) {
  // Only safe classifications are logged; database errors can contain user data.
  process.stderr.write(
    JSON.stringify({
      level: "error",
      event,
      errorType: error instanceof Error ? error.name : "Unknown",
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
}

let lastAlertAt = 0;
export async function reportError(event: string, error: unknown) {
  logError(event, error);
  const url = process.env.OPERATIONS_ALERT_WEBHOOK_URL;
  if (!url?.startsWith("https://") || Date.now() - lastAlertAt < 60000) return;
  lastAlertAt = Date.now();
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : "Unknown",
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    logError("alert.delivery.failed", new Error("AlertDeliveryError"));
  }
}

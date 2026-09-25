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

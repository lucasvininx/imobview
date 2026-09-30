import { it, expect, vi } from "vitest";

it("reports a rejected alert delivery without logging exception contents", async () => {
  vi.resetModules();
  vi.stubEnv("OPERATIONS_ALERT_WEBHOOK_URL", "https://alerts.example/events");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const stderr = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  try {
    const { reportError } = await import("@/server/logger");
    await reportError(
      "request.unhandled",
      new Error("private-token-must-not-appear"),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const logs = stderr.mock.calls.map((call) => String(call[0])).join("");
    expect(logs).toContain("alert.delivery.failed");
    expect(logs).not.toContain("private-token");
    expect(fetchMock.mock.calls[0][1].body).not.toContain("private-token");
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    stderr.mockRestore();
  }
});

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readEnv } = await import("@/config/env");
    readEnv();
  }
}
export async function onRequestError(error: unknown) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportError } = await import("@/server/logger");
    await reportError("request.unhandled", error);
  }
}

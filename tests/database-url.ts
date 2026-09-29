export function testAdminUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const runtime = new URL(env.TEST_DATABASE_URL ?? "");
  const admin = new URL(
    env.TEST_DIRECT_DATABASE_URL ?? env.DIRECT_DATABASE_URL ?? "",
  );
  if (
    !runtime.pathname.endsWith("_test") ||
    !["localhost", "127.0.0.1"].includes(runtime.hostname) ||
    admin.hostname !== runtime.hostname ||
    admin.port !== runtime.port
  ) {
    throw new Error(
      "Tests require an isolated local database. Configure TEST_DIRECT_DATABASE_URL for its administrative connection.",
    );
  }
  admin.pathname = runtime.pathname;
  return admin.toString();
}
